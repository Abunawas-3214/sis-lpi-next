import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, hashPassword } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getSessionUser(request);
  const legacyToken = request.cookies.get("admin_session")?.value;
  const isSuper =
    (currentUser && currentUser.role === "super_admin") ||
    legacyToken === "authenticated";

  if (!isSuper) {
    return NextResponse.json(
      { error: "Hanya Super Admin yang dapat menghapus Admin" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const targetId = parseInt(id);

    if (currentUser && currentUser.id === targetId) {
      return NextResponse.json(
        { error: "Anda tidak dapat menghapus akun Anda sendiri" },
        { status: 400 }
      );
    }

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    if (targetUser.role === "super_admin") {
      return NextResponse.json(
        { error: "Tidak dapat menghapus akun Super Admin utama" },
        { status: 400 }
      );
    }

    await db.delete(users).where(eq(users.id, targetId));

    return NextResponse.json({ message: "Admin berhasil dihapus" });
  } catch (error: any) {
    console.error("Error deleting admin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getSessionUser(request);
  const legacyToken = request.cookies.get("admin_session")?.value;
  const isSuper =
    (currentUser && currentUser.role === "super_admin") ||
    legacyToken === "authenticated";

  if (!isSuper) {
    return NextResponse.json(
      { error: "Hanya Super Admin yang dapat mengubah data Admin" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const targetId = parseInt(id);
    const body = await request.json();

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (body.name) updateData.name = body.name.trim();
    if (body.email !== undefined) updateData.email = body.email ? body.email.trim() : null;
    if (body.isActive !== undefined) updateData.isActive = String(body.isActive);
    if (body.password) {
      updateData.password = hashPassword(body.password);
    }

    await db.update(users).set(updateData).where(eq(users.id, targetId));

    return NextResponse.json({ message: "Data Admin berhasil diperbarui" });
  } catch (error: any) {
    console.error("Error updating admin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
