import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestedEdits, institutions, institutionPolygons } from "@/lib/db/schema";
import { applySuggestedEdit } from "@/lib/db/apply-edit";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { normalizePolygons, calculateAreaM2, toLeafletLatLngs } from "@/lib/geometry";

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
    const approvalNotes = body.notes || body.reason || "Disetujui oleh Administrator";

    const edits = await db
      .select()
      .from(suggestedEdits)
      .where(
        and(
          eq(suggestedEdits.institutionId, id),
          eq(suggestedEdits.status, "pending")
        )
      );

    if (edits.length === 0) {
      // Even if no pending suggested_edits record, ensure institution status is set to valid
      await db
        .update(institutions)
        .set({ verificationStatus: "valid", updatedAt: new Date() })
        .where(eq(institutions.id, id));

      return NextResponse.json({
        message: "Status institusi berhasil disetujui menjadi Valid.",
      });
    }

    let approvedCount = 0;
    for (const edit of edits) {
      try {
        await applySuggestedEdit(edit);
        await db
          .update(suggestedEdits)
          .set({
            status: "approved",
            reviewerNotes: approvalNotes,
            reviewedAt: new Date(),
          })
          .where(eq(suggestedEdits.id, edit.id));
        approvedCount++;
      } catch (err) {
        console.error(`Failed to apply edit ${edit.id}:`, err);
      }
    }

    // Set institution verification status to valid
    await db
      .update(institutions)
      .set({ verificationStatus: "valid", updatedAt: new Date() })
      .where(eq(institutions.id, id));

    // Ensure institution_polygons table is in sync with latest landGeometry after edits
    const [inst] = await db
      .select({ name: institutions.name, landGeometry: institutions.landGeometry })
      .from(institutions)
      .where(eq(institutions.id, id))
      .limit(1);

    if (inst?.landGeometry) {
      const normalized = normalizePolygons(inst.landGeometry, inst.name);
      const newPolyIds = normalized.map((p) => p.id);

      // Delete polygons that no longer exist in the approved landGeometry
      const existingPolys = await db
        .select({ id: institutionPolygons.id })
        .from(institutionPolygons)
        .where(eq(institutionPolygons.institutionId, id));

      for (const ep of existingPolys) {
        if (!newPolyIds.includes(ep.id)) {
          await db
            .delete(institutionPolygons)
            .where(eq(institutionPolygons.id, ep.id));
        }
      }

      // Upsert the remaining/new polygons
      for (const p of normalized) {
        const area = p.area_m2 || calculateAreaM2(toLeafletLatLngs(p.coordinates));
        await db
          .insert(institutionPolygons)
          .values({
            id: p.id,
            institutionId: id,
            name: p.name,
            coordinates: p.coordinates,
            areaM2: area,
          })
          .onConflictDoUpdate({
            target: institutionPolygons.id,
            set: {
              name: p.name,
              coordinates: p.coordinates,
              areaM2: area,
              updatedAt: new Date(),
            },
          });
      }
    }

    return NextResponse.json({
      message: `Seluruh perubahan institusi berhasil disetujui (${approvedCount} usulan). Status institusi kini Valid.`,
      approvedCount,
    });
  } catch (error: any) {
    console.error("Error approving institution edits:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
