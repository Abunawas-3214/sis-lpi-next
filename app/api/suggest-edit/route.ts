import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions, suggestedEdits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data) {
      return NextResponse.json(
        { error: "Request body is required" },
        { status: 400 }
      );
    }

    const actionType = data.action_type || "update";
    if (!["update", "create", "delete"].includes(actionType)) {
      return NextResponse.json(
        { error: "action_type must be 'update', 'create', or 'delete'" },
        { status: 400 }
      );
    }

    if (!data.field_name) {
      return NextResponse.json(
        { error: "field_name is required" },
        { status: 400 }
      );
    }

    let institutionName = data.institution_name;
    let institutionId = data.institution_id;
    let suggestedPayload = data.suggested_payload;

    if (actionType === "update" || actionType === "delete") {
      if (!institutionId) {
        return NextResponse.json(
          { error: "institution_id is required for updates/deletes" },
          { status: 400 }
        );
      }

      const [inst] = await db
        .select({ name: institutions.name })
        .from(institutions)
        .where(eq(institutions.id, institutionId))
        .limit(1);

      if (!inst) {
        return NextResponse.json(
          { error: "Institution not found" },
          { status: 404 }
        );
      }
      institutionName = inst.name;
    } else if (actionType === "create") {
      if (typeof suggestedPayload === "string") {
        try {
          suggestedPayload = JSON.parse(suggestedPayload);
        } catch {
          suggestedPayload = null;
        }
      }
      if (!suggestedPayload) {
        return NextResponse.json(
          { error: "suggested_payload is required for create suggestions" },
          { status: 400 }
        );
      }
      institutionName = suggestedPayload.name || institutionName || "Lembaga Baru";
    }

    const [inserted] = await db
      .insert(suggestedEdits)
      .values({
        batchId: data.batch_id || crypto.randomUUID(),
        institutionId: institutionId || null,
        institutionName: institutionName || null,
        actionType,
        suggestedPayload,
        submitterName: data.submitter_name || null,
        submitterRole: data.submitter_role || null,
        submitterEmail: data.submitter_email || null,
        fieldName: data.field_name,
        currentValue: data.current_value || null,
        suggestedValue: data.suggested_value || null,
        suggestedGeometry: data.suggested_geometry || null,
        status: "pending",
      })
      .returning({ id: suggestedEdits.id, batchId: suggestedEdits.batchId });

    return NextResponse.json(
      {
        message: "Saran perubahan berhasil dikirim. Menunggu verifikasi admin.",
        edit_id: inserted.id,
        batch_id: inserted.batchId,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error submitting suggested edit:", error);
    return NextResponse.json(
      { error: "Failed to submit suggestion", details: error.message },
      { status: 500 }
    );
  }
}
