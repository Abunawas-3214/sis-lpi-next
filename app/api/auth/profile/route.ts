import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, hashPassword, verifyPassword, signToken, UserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, ne, and, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) {
      return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    }

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        institutionId: users.institutionId,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Gagal mengambil data profil: " + error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) {
      return NextResponse.json({ error: "Sesi telah berakhir, silakan login kembali" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, currentPassword, newPassword, confirmPassword } = body;

    // Ambil data user dari database
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });
    }

    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    // 1. Validasi & Perubahan Nama (jika disediakan)
    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (trimmedName.length < 2) {
        return NextResponse.json({ error: "Nama minimal 2 karakter" }, { status: 400 });
      }
      updates.name = trimmedName;
    }

    // 2. Validasi & Perubahan Email
    if (email !== undefined) {
      const trimmedEmail = email ? String(email).trim().toLowerCase() : null;
      if (trimmedEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
        }

        // Cek apakah email sudah digunakan user lain
        const [duplicate] = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              sql`LOWER(${users.email}) = LOWER(${trimmedEmail})`,
              ne(users.id, session.id)
            )
          )
          .limit(1);

        if (duplicate) {
          return NextResponse.json(
            { error: "Email sudah digunakan oleh akun lain. Silakan gunakan email lain." },
            { status: 400 }
          );
        }

        updates.email = trimmedEmail;
      } else {
        // Email dikosongkan (nullable)
        updates.email = null;
      }
    }

    // 3. Validasi & Perubahan Password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Kata sandi saat ini wajib diisi untuk mengubah kata sandi" },
          { status: 400 }
        );
      }

      const isCurrentValid = verifyPassword(currentPassword, currentUser.password);
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: "Kata sandi saat ini tidak cocok" },
          { status: 400 }
        );
      }

      if (String(newPassword).length < 6) {
        return NextResponse.json(
          { error: "Kata sandi baru minimal 6 karakter" },
          { status: 400 }
        );
      }

      if (newPassword !== confirmPassword) {
        return NextResponse.json(
          { error: "Konfirmasi kata sandi baru tidak sama" },
          { status: 400 }
        );
      }

      updates.password = hashPassword(newPassword);
    }

    // Update database
    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, session.id));

    // Siapkan payload session baru
    const updatedName = updates.name || currentUser.name;
    const updatedEmail = updates.email !== undefined ? updates.email : currentUser.email;

    const newSessionPayload: UserSession = {
      id: currentUser.id,
      username: currentUser.username,
      name: updatedName,
      role: currentUser.role as "super_admin" | "admin" | "institusi",
      institutionId: currentUser.institutionId,
      email: updatedEmail,
    };

    const newToken = signToken(newSessionPayload);

    const response = NextResponse.json({
      status: "ok",
      message: "Profil akun berhasil diperbarui",
      user: {
        id: currentUser.id,
        username: currentUser.username,
        name: updatedName,
        role: currentUser.role,
        institutionId: currentUser.institutionId,
        email: updatedEmail,
      },
    });

    // Refresh cookie sesi dengan data terbaru
    response.cookies.set("auth_session", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server saat memperbarui profil: " + error.message },
      { status: 500 }
    );
  }
}
