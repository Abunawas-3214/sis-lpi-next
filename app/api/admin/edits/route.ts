import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suggestedEdits, institutions } from "@/lib/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { normalizePolygons, calculateAreaM2, toLeafletLatLngs } from "@/lib/geometry";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  const token = request.cookies.get("admin_session")?.value;
  const isAuth =
    (user && (user.role === "super_admin" || user.role === "admin")) ||
    token === "authenticated";

  if (!isAuth) {
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

    // Get all referenced institution IDs
    const instIds = Array.from(
      new Set(allEdits.map((e) => e.institutionId).filter(Boolean))
    ) as string[];

    const instRows =
      instIds.length > 0
        ? await db
            .select({
              id: institutions.id,
              name: institutions.name,
              type: institutions.type,
              latitude: institutions.latitude,
              longitude: institutions.longitude,
              landGeometry: institutions.landGeometry,
              landTotalAreaM2: institutions.landTotalAreaM2,
              verificationStatus: institutions.verificationStatus,
            })
            .from(institutions)
            .where(inArray(institutions.id, instIds))
        : [];

    const instMap = new Map(instRows.map((i) => [i.id, i]));

    // Group edits by institution
    const institutionGroups: Record<string, any> = {};
    const noInstitutionGroups: any[] = [];

    // Process from oldest to newest so final state overlays cleanly
    const chronologicalEdits = [...allEdits].reverse();

    for (const e of chronologicalEdits) {
      const instId = e.institutionId;

      if (!instId) {
        // Crowdsourced or new institution proposal without an institution ID
        noInstitutionGroups.push({
          institution_id: null,
          institution_name: e.institutionName || "Usulan Lembaga Baru",
          submitter_name: e.submitterName,
          submitter_role: e.submitterRole || "Warga",
          submitter_email: e.submitterEmail,
          created_at: e.createdAt?.toISOString() || null,
          status: e.status,
          batch_ids: e.batchId ? [e.batchId] : [],
          coordinates: null,
          institution_type: "pesantren",
          data_institusi: {
            has_changes: true,
            changes: [
              {
                field: e.fieldName,
                label: e.fieldName,
                before: e.currentValue || "-",
                after: e.suggestedValue || "-",
              },
            ],
          },
          polygon: {
            has_changes: Boolean(e.suggestedGeometry),
            diff: null,
            previous_polygons: [],
            new_polygons: e.suggestedGeometry ? normalizePolygons(e.suggestedGeometry, e.institutionName || "") : [],
            suggested_geometry: e.suggestedGeometry,
          },
          raw_edits: [e],
        });
        continue;
      }

      const inst = instMap.get(instId);

      if (!institutionGroups[instId]) {
        institutionGroups[instId] = {
          institution_id: instId,
          institution_name: inst?.name || e.institutionName || "Lembaga",
          submitter_name: e.submitterName,
          submitter_role: e.submitterRole || "Institusi",
          submitter_email: e.submitterEmail,
          created_at: e.createdAt?.toISOString() || null,
          latest_created_at: e.createdAt?.toISOString() || null,
          status: e.status,
          batch_ids: [],
          coordinates:
            inst?.latitude && inst?.longitude
              ? [inst.latitude, inst.longitude]
              : null,
          institution_type: inst?.type || "pesantren",
          data_institusi: {
            has_changes: false,
            changes_map: new Map<string, { field: string; label: string; before: any; after: any }>(),
          },
          polygon: {
            has_changes: false,
            diff: null,
            previous_polygons: inst?.landGeometry
              ? normalizePolygons(inst.landGeometry, inst?.name)
              : [],
            new_polygons: [],
            suggested_geometry: null,
          },
          raw_edits: [],
        };
      }

      const grp = institutionGroups[instId];
      grp.latest_created_at = e.createdAt?.toISOString() || grp.latest_created_at;
      if (e.batchId && !grp.batch_ids.includes(e.batchId)) {
        grp.batch_ids.push(e.batchId);
      }
      grp.raw_edits.push(e);

      // Parse payload
      let payload = e.suggestedPayload as any;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {}
      }

      // ── Category 1: Perubahan Data Institusi ──
      if (
        e.fieldName === "perubahan_data_institusi" ||
        e.fieldName === "pengajuan_data_dan_polygon"
      ) {
        if (payload?.changes) {
          for (const [k, v] of Object.entries(payload.changes)) {
            const item = v as any;
            const existing = grp.data_institusi.changes_map.get(k);
            grp.data_institusi.changes_map.set(k, {
              field: k,
              label: item.label || k,
              before: existing ? existing.before : item.before ?? "-",
              after: item.after ?? "-",
            });
            grp.data_institusi.has_changes = true;
          }
        } else if (e.currentValue && e.suggestedValue) {
          try {
            const curr = JSON.parse(e.currentValue);
            const sugg = JSON.parse(e.suggestedValue);
            for (const k of Object.keys({ ...curr, ...sugg })) {
              if (k !== "hasPolygon" && k !== "parcelsCount") {
                if (curr[k] !== sugg[k]) {
                  const existing = grp.data_institusi.changes_map.get(k);
                  grp.data_institusi.changes_map.set(k, {
                    field: k,
                    label:
                      k === "notes"
                        ? "Catatan / Keterangan"
                        : k === "landTotalAreaM2"
                        ? "Total Luas Tanah (m²)"
                        : k,
                    before: existing ? existing.before : curr[k] ?? "-",
                    after: sugg[k] ?? "-",
                  });
                  grp.data_institusi.has_changes = true;
                }
              }
            }
          } catch {}
        }
      }

      // ── Category 2: Perubahan Data Polygon ──
      if (
        e.fieldName === "perubahan_polygon" ||
        e.fieldName === "pengajuan_data_dan_polygon" ||
        e.suggestedGeometry
      ) {
        const suggGeom = e.suggestedGeometry || payload?.landGeometry;
        const recordedPrev = payload?.previousPolygons || [];
        const prevPolys =
          recordedPrev.length > 0 ? recordedPrev : grp.polygon.previous_polygons;

        if (payload?.diff) {
          grp.polygon.has_changes = true;
          grp.polygon.diff = {
            ...payload.diff,
            total_before:
              payload.diff.total_before ??
              payload.diff.total_polygons_before ??
              prevPolys.length,
            total_after:
              payload.diff.total_after ??
              payload.diff.total_polygons_after ??
              (payload.newPolygons?.length || 0),
          };
          grp.polygon.previous_polygons = prevPolys;
          grp.polygon.new_polygons =
            payload.newPolygons ||
            (suggGeom
              ? normalizePolygons(suggGeom, inst?.name || grp.institution_name)
              : []);
          grp.polygon.suggested_geometry = suggGeom;
        } else if (suggGeom) {
          const nextPolys = normalizePolygons(suggGeom, inst?.name || grp.institution_name);

          // Detect added, modified, deleted polygons
          const addedPolys: any[] = [];
          const modifiedPolys: any[] = [];
          const deletedPolys: any[] = [];

          const prevMap = new Map(prevPolys.map((p: any) => [p.id, p]));
          const nextMap = new Map(nextPolys.map((p: any) => [p.id, p]));

          for (const np of nextPolys) {
            const op = prevMap.get(np.id) as any;
            if (!op) {
              addedPolys.push({
                id: np.id,
                name: np.name,
                category: np.category || "kampus",
                area_m2: np.area_m2,
                points_count: np.coordinates?.length || 0,
              });
            } else {
              const isNameDiff = np.name !== op.name;
              const isAreaDiff = Math.abs((np.area_m2 || 0) - (op.area_m2 || 0)) > 1;
              const isGeomDiff =
                JSON.stringify(np.coordinates) !== JSON.stringify(op.coordinates);
              if (isNameDiff || isAreaDiff || isGeomDiff) {
                modifiedPolys.push({
                  id: np.id,
                  name: np.name,
                  before_name: op.name,
                  after_name: np.name,
                  before_area_m2: op.area_m2,
                  after_area_m2: np.area_m2,
                  area_diff_m2: (np.area_m2 || 0) - (op.area_m2 || 0),
                  before_points_count: op.coordinates?.length || 0,
                  after_points_count: np.coordinates?.length || 0,
                });
              }
            }
          }

          for (const op of prevPolys) {
            if (!nextMap.has((op as any).id)) {
              deletedPolys.push({
                id: (op as any).id,
                name: (op as any).name,
                category: (op as any).category || "kampus",
                area_m2: (op as any).area_m2,
                points_count: (op as any).coordinates?.length || 0,
              });
            }
          }

          grp.polygon.has_changes = true;
          grp.polygon.previous_polygons = prevPolys;
          grp.polygon.new_polygons = nextPolys;
          grp.polygon.suggested_geometry = suggGeom;
          grp.polygon.diff = {
            added: addedPolys,
            modified: modifiedPolys,
            deleted: deletedPolys,
            total_before: prevPolys.length,
            total_after: nextPolys.length,
            total_area_before: prevPolys.reduce((s: number, p: any) => s + (p.area_m2 || 0), 0),
            total_area_after: nextPolys.reduce((s: number, p: any) => s + (p.area_m2 || 0), 0),
          };
        }
      }
    }

    // Convert map to array and format output
    const formattedGroups = Object.values(institutionGroups).map((g) => ({
      ...g,
      data_institusi: {
        has_changes: g.data_institusi.has_changes,
        changes: Array.from(g.data_institusi.changes_map.values()),
      },
    }));

    const result = [...formattedGroups, ...noInstitutionGroups];
    result.sort((a, b) => (b.latest_created_at || "").localeCompare(a.latest_created_at || ""));

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
