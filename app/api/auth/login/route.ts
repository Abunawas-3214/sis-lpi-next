import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, signToken, UserSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi" },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();

    // Query user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, trimmedUsername))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan" },
        { status: 401 }
      );
    }

    if (user.isActive === false || String(user.isActive) === "false") {
      return NextResponse.json(
        { error: "Akun ini telah dinonaktifkan" },
        { status: 403 }
      );
    }

    const isValid = verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Password salah" },
        { status: 401 }
      );
    }

    const sessionPayload: UserSession = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as "super_admin" | "admin" | "institusi",
      institutionId: user.institutionId,
    };

    const token = signToken(sessionPayload);

    const response = NextResponse.json({
      status: "ok",
      user: sessionPayload,
    });

    // Set auth_session cookie
    response.cookies.set("auth_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Set admin_session cookie for backward compatibility with existing admin API checks
    if (user.role === "super_admin" || user.role === "admin") {
      response.cookies.set("admin_session", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server: " + error.message },
      { status: 500 }
    );
  }
}
