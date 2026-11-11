import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestedEdits, institutions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  const token = request.cookies.get("admin_session")?.value;
  const isAuth =
    (user && (user.role === "super_admin" || user.role === "admin")) ||
    token === "authenticated";

  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body.notes || body.reason || "Perubahan ditolak oleh admin verifikator.";

    const edits = await db
      .select()
      .from(suggestedEdits)
      .where(
        and(
          eq(suggestedEdits.institutionId, id),
          eq(suggestedEdits.status, "pending")
        )
      );

    if (edits.length > 0) {
      await db
        .update(suggestedEdits)
        .set({
          status: "rejected",
          reviewerNotes: reason,
          reviewedAt: new Date(),
        })
        .where(
          and(
            eq(suggestedEdits.institutionId, id),
            eq(suggestedEdits.status, "pending")
          )
        );
    }

    // Set institution verification status to perbaikan
    await db
      .update(institutions)
      .set({
        verificationStatus: "perbaikan",
        updatedAt: new Date(),
      })
      .where(eq(institutions.id, id));

    return NextResponse.json({
      message: `Perubahan institusi ditolak (${edits.length} usulan). Status institusi kini 'Perbaikan'.`,
      rejectedCount: edits.length,
    });
  } catch (error: any) {
    console.error("Error rejecting institution edits:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
