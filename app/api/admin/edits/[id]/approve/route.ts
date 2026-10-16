import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestedEdits } from "@/lib/db/schema";
import { applySuggestedEdit } from "@/lib/db/apply-edit";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("admin_session")?.value;
  if (token !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const editId = parseInt(id);
    const body = await request.json().catch(() => ({}));

    const [edit] = await db
      .select()
      .from(suggestedEdits)
      .where(eq(suggestedEdits.id, editId))
      .limit(1);

    if (!edit) {
      return NextResponse.json({ error: "Edit not found" }, { status: 404 });
    }

    if (edit.status !== "pending") {
      return NextResponse.json(
        { error: `Edit already ${edit.status}` },
        { status: 400 }
      );
    }

    await applySuggestedEdit(edit);

    await db
      .update(suggestedEdits)
      .set({
        status: "approved",
        reviewerNotes: body.notes || "",
        reviewedAt: new Date(),
      })
      .where(eq(suggestedEdits.id, editId));

    return NextResponse.json({ message: "Edit approved successfully." });
  } catch (error: any) {
    console.error("Error approving edit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
