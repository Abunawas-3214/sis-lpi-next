import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestedEdits, institutions } from "@/lib/db/schema";
import { applySuggestedEdit } from "@/lib/db/apply-edit";
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

    let approved = 0;
    const institutionIds = new Set<string>();

    for (const edit of edits) {
      try {
        await applySuggestedEdit(edit);
        await db
          .update(suggestedEdits)
          .set({ status: "approved", reviewedAt: new Date() })
          .where(eq(suggestedEdits.id, edit.id));
        approved++;
        if (edit.institutionId) {
          institutionIds.add(edit.institutionId);
        }
      } catch (err) {
        console.error(`Failed to apply edit ${edit.id}:`, err);
      }
    }

    // Set institution verification status to valid
    for (const instId of institutionIds) {
      await db
        .update(institutions)
        .set({ verificationStatus: "valid", updatedAt: new Date() })
        .where(eq(institutions.id, instId));
    }

    return NextResponse.json({ message: `${approved} edits approved.` });
  } catch (error: any) {
    console.error("Error approving batch:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
