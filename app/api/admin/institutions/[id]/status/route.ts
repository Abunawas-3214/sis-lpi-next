import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getSessionUser(request);
  const legacyToken = request.cookies.get("admin_session")?.value;
  const isAuth =
    (currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin")) ||
    legacyToken === "authenticated";

  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body; // 'valid' | 'tidak_valid' | 'pengajuan'

    if (!["valid", "tidak_valid", "pengajuan"].includes(status)) {
      return NextResponse.json(
        { error: "Status harus salah satu dari: valid, tidak_valid, pengajuan" },
        { status: 400 }
      );
    }

    await db
      .update(institutions)
      .set({
        verificationStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(institutions.id, id));

    return NextResponse.json({
      message: `Status verifikasi institusi berhasil diubah menjadi ${status}`,
      status,
    });
  } catch (error: any) {
    console.error("Error updating verification status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
