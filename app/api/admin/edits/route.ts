import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestedEdits } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (token !== "authenticated") {
    return NextResponse.json(
      { error: "Unauthorized. Please login as admin." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "pending";

    const query = db.select().from(suggestedEdits);
    const allEdits =
      statusFilter === "all"
        ? await query.orderBy(desc(suggestedEdits.createdAt))
        : await query
            .where(eq(suggestedEdits.status, statusFilter))
            .orderBy(desc(suggestedEdits.createdAt));

    const batches: Record<string, any> = {};
    const noBatch: any[] = [];

    for (const e of allEdits) {
      const entry = {
        id: e.id,
        institution_id: e.institutionId,
        institution_name: e.institutionName,
        submitter_name: e.submitterName,
        submitter_role: e.submitterRole,
        submitter_email: e.submitterEmail,
        action_type: e.actionType || "update",
        field_name: e.fieldName,
        current_value: e.currentValue,
        suggested_value: e.suggestedValue,
        suggested_payload: e.suggestedPayload,
        has_geometry: Boolean(e.suggestedGeometry),
        suggested_geometry: e.suggestedGeometry,
        status: e.status,
        reviewer_notes: e.reviewerNotes,
        created_at: e.createdAt?.toISOString() || null,
        reviewed_at: e.reviewedAt?.toISOString() || null,
      };

      if (e.batchId) {
        if (!batches[e.batchId]) {
          batches[e.batchId] = {
            batch_id: e.batchId,
            institution_id: e.institutionId,
            institution_name: e.institutionName,
            submitter_name: e.submitterName,
            submitter_role: e.submitterRole,
            submitter_email: e.submitterEmail,
            created_at: e.createdAt?.toISOString() || null,
            edits: [],
          };
        }
        batches[e.batchId].edits.push(entry);
      } else {
        noBatch.push({
          batch_id: null,
          institution_id: e.institutionId,
          institution_name: e.institutionName,
          submitter_name: e.submitterName,
          submitter_role: e.submitterRole,
          submitter_email: e.submitterEmail,
          created_at: e.createdAt?.toISOString() || null,
          edits: [entry],
        });
      }
    }

    const result = [...Object.values(batches), ...noBatch];
    result.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    return NextResponse.json({
      count: result.length,
      total_edits: allEdits.length,
      data: result,
    });
  } catch (error: any) {
    console.error("Error listing edits:", error);
    return NextResponse.json(
      { error: "Failed to list edits", details: error.message },
      { status: 500 }
    );
  }
}
