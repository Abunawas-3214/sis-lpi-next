import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestedEdits, institutions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request);
  const token = request.cookies.get("admin_session")?.value;
  const isAuth = (user && (user.role === "super_admin" || user.role === "admin")) || token === "authenticated";
  if (!isAuth) {
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

    await db
      .update(suggestedEdits)
      .set({
        status: "rejected",
        reviewerNotes: body.notes || "",
        reviewedAt: new Date(),
      })
      .where(eq(suggestedEdits.id, editId));

    if (edit.institutionId) {
      await db
        .update(institutions)
        .set({ verificationStatus: "tidak_valid", updatedAt: new Date() })
        .where(eq(institutions.id, edit.institutionId));
    }

    return NextResponse.json({ message: "Edit rejected." });
  } catch (error: any) {
    console.error("Error rejecting edit:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

