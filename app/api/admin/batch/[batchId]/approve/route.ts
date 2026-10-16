import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestedEdits } from "@/lib/db/schema";
import { applySuggestedEdit } from "@/lib/db/apply-edit";
import { and, eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;
  if (token !== "authenticated") {
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
    for (const edit of edits) {
      try {
        await applySuggestedEdit(edit);
        await db
          .update(suggestedEdits)
          .set({ status: "approved", reviewedAt: new Date() })
          .where(eq(suggestedEdits.id, edit.id));
        approved++;
      } catch (err) {
        console.error(`Failed to apply edit ${edit.id}:`, err);
      }
    }

    return NextResponse.json({ message: `${approved} edits approved.` });
  } catch (error: any) {
    console.error("Error approving batch:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
