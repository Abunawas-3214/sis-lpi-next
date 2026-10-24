import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestedEdits, institutions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const user = await getSessionUser(request);
  const token = request.cookies.get("admin_session")?.value;
  const isAuth = (user && (user.role === "super_admin" || user.role === "admin")) || token === "authenticated";
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { batchId } = await params;
    const body = await request.json().catch(() => ({}));

    const edits = await db
      .select()
      .from(suggestedEdits)
      .where(
        and(
          eq(suggestedEdits.batchId, batchId),
          eq(suggestedEdits.status, "pending")
        )
      );

    if (edits.length === 0) {
      return NextResponse.json(
        { error: "No pending edits in this batch" },
        { status: 404 }
      );
    }

    await db
      .update(suggestedEdits)
      .set({
        status: "rejected",
        reviewerNotes: body.notes || "",
        reviewedAt: new Date(),
      })
      .where(
        and(
          eq(suggestedEdits.batchId, batchId),
          eq(suggestedEdits.status, "pending")
        )
      );

    // Set institution verification status to tidak_valid
    for (const edit of edits) {
      if (edit.institutionId) {
        await db
          .update(institutions)
          .set({ verificationStatus: "tidak_valid", updatedAt: new Date() })
          .where(eq(institutions.id, edit.institutionId));
      }
    }

    return NextResponse.json({ message: `${edits.length} edits rejected.` });
  } catch (error: any) {
    console.error("Error rejecting batch:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
