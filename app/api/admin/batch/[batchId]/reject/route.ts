import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestedEdits } from "@/lib/db/schema";
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

    return NextResponse.json({ message: `${edits.length} edits rejected.` });
  } catch (error: any) {
    console.error("Error rejecting batch:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
