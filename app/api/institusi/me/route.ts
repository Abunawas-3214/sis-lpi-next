import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions, suggestedEdits } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { normalizePolygons, calculateAreaM2, toLeafletLatLngs } from "@/lib/geometry";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Sesi login berakhir" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let targetInstId = currentUser.institutionId;

    // Admins can view specific institution
    if (
      (currentUser.role === "super_admin" || currentUser.role === "admin") &&
      searchParams.get("id")
    ) {
      targetInstId = searchParams.get("id");
    }

    if (!targetInstId) {
      return NextResponse.json(
        { error: "Akun ini tidak tertaut ke institusi manapun" },
        { status: 404 }
      );
    }

    const [inst] = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, targetInstId))
      .limit(1);

    if (!inst) {
      return NextResponse.json(
        { error: "Data institusi tidak ditemukan" },
        { status: 404 }
      );
    }

    // Pending edits for this institution
    const pending = await db
      .select()
      .from(suggestedEdits)
      .where(
        sql`${suggestedEdits.institutionId} = ${targetInstId} AND ${suggestedEdits.status} = 'pending'`
      );

    // Query all edits for this institution for complete history
    const allEdits = await db
      .select()
      .from(suggestedEdits)
      .where(eq(suggestedEdits.institutionId, targetInstId))
      .orderBy(sql`${suggestedEdits.createdAt} DESC`);

    // Group edits into submission batches for history
    const batchMap = new Map<string, any>();
    for (const e of allEdits) {
      const bId = e.batchId || `single-${e.id}`;
      if (!batchMap.has(bId)) {
        batchMap.set(bId, {
          batchId: bId,
          status: e.status,
          createdAt: e.createdAt,
          reviewedAt: e.reviewedAt,
          reviewerNotes: e.reviewerNotes,
          submitterName: e.submitterName,
          submitterRole: e.submitterRole,
          data_institusi: null,
          polygon: null,
          rawEdits: [],
        });
      }
      const b = batchMap.get(bId);
      b.rawEdits.push(e);
      if (e.reviewerNotes && !b.reviewerNotes) {
        b.reviewerNotes = e.reviewerNotes;
      }
      if (e.reviewedAt && !b.reviewedAt) {
        b.reviewedAt = e.reviewedAt;
      }
      if (e.status === "pending") b.status = "pending";
      else if (e.status === "rejected" && b.status !== "pending") b.status = "rejected";

      let payload = e.suggestedPayload as any;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = {};
        }
      }

      if (
        e.fieldName === "perubahan_data_institusi" ||
        e.fieldName === "pengajuan_data_dan_polygon"
      ) {
        let changes = payload?.changes;
        if (!changes && e.suggestedValue) {
          try {
            const afterObj = JSON.parse(e.suggestedValue);
            const beforeObj = e.currentValue ? JSON.parse(e.currentValue) : {};
            changes = {};
            for (const k of Object.keys(afterObj)) {
              if (k !== "hasPolygon" && k !== "parcelsCount") {
                changes[k] = { label: k, before: beforeObj[k], after: afterObj[k] };
              }
            }
          } catch {}
        }
        if (changes && Object.keys(changes).length > 0) {
          b.data_institusi = {
            changes: changes,
            submittedAt: payload?.submittedAt || e.createdAt,
          };
        }
      }

      if (
        e.fieldName === "perubahan_polygon" ||
        e.fieldName === "land_geometry" ||
        e.fieldName === "pengajuan_data_dan_polygon" ||
        e.suggestedGeometry
      ) {
        const suggGeom = e.suggestedGeometry || payload?.landGeometry;
        let prevPolys = payload?.previousPolygons || [];
        let nextPolys = payload?.newPolygons || [];

        if (prevPolys.length === 0 && inst.landGeometry) {
          prevPolys = normalizePolygons(inst.landGeometry, inst.name);
        }
        if (nextPolys.length === 0 && suggGeom) {
          nextPolys = normalizePolygons(suggGeom, inst.name);
        }

        let diff = payload?.diff || null;
        if (!diff && (prevPolys.length > 0 || nextPolys.length > 0)) {
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
              const isGeomDiff = JSON.stringify(np.coordinates) !== JSON.stringify(op.coordinates);
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

          diff = {
            added: addedPolys,
            modified: modifiedPolys,
            deleted: deletedPolys,
            total_before: prevPolys.length,
            total_after: nextPolys.length,
            total_area_before: prevPolys.reduce((s: number, p: any) => s + (p.area_m2 || 0), 0),
            total_area_after: nextPolys.reduce((s: number, p: any) => s + (p.area_m2 || 0), 0),
          };
        }

        b.polygon = {
          diff,
          previousPolygons: prevPolys,
          newPolygons: nextPolys,
          suggestedGeometry: suggGeom,
          submittedAt: payload?.submittedAt || e.createdAt,
        };
      }
    }

    const historyBatches = Array.from(batchMap.values());
    const isLocked = inst.verificationStatus === "pengajuan" || pending.length > 0;

    // Detect which specific polygons or categories are pending
    const pendingPolygonIds: string[] = [];
    let hasPendingPolygon = false;
    let hasPendingProfile = false;

    for (const e of pending) {
      const payload = e.suggestedPayload as any;
      if (
        payload?.category === "perubahan_polygon" ||
        e.fieldName === "perubahan_polygon" ||
        e.actionType === "delete_polygon" ||
        e.actionType === "add_polygon"
      ) {
        hasPendingPolygon = true;
        if (payload?.diff) {
          payload.diff.added?.forEach((p: any) => p?.id && pendingPolygonIds.push(p.id));
          payload.diff.modified?.forEach((p: any) => p?.id && pendingPolygonIds.push(p.id));
          payload.diff.deleted?.forEach((p: any) => p?.id && pendingPolygonIds.push(p.id));
        }
      }
      if (
        payload?.category === "perubahan_data_institusi" ||
        e.fieldName === "perubahan_data_institusi"
      ) {
        hasPendingProfile = true;
      }
    }

    return NextResponse.json({
      institution: inst,
      isLocked,
      hasPendingPolygon,
      hasPendingProfile,
      pendingPolygonIds: Array.from(new Set(pendingPolygonIds)),
      pendingEdits: pending,
      historyEdits: allEdits,
      historyBatches,
      user: currentUser,
    });
  } catch (error: any) {
    console.error("Error fetching institution me:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Sesi login berakhir" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let targetInstId = currentUser.institutionId;

    if (
      (currentUser.role === "super_admin" || currentUser.role === "admin") &&
      searchParams.get("id")
    ) {
      targetInstId = searchParams.get("id");
    }

    if (!targetInstId) {
      return NextResponse.json(
        { error: "Akun ini tidak tertaut ke institusi manapun" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // 1. Fetch current institution data
    const [currentInst] = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, targetInstId))
      .limit(1);

    if (!currentInst) {
      return NextResponse.json(
        { error: "Data institusi tidak ditemukan" },
        { status: 404 }
      );
    }

    // Lock check: If institution is already in 'pengajuan' status, reject new edits from institution operator
    const isPending = currentInst.verificationStatus === "pengajuan";
    const isAdmin = currentUser.role === "super_admin" || currentUser.role === "admin";
    if (isPending && !isAdmin) {
      return NextResponse.json(
        {
          error:
            "Pengajuan sebelumnya masih dalam proses peninjauan oleh Admin verifikator. Anda tidak dapat melakukan perubahan data baru hingga pengajuan saat ini disetujui atau ditolak.",
          isLocked: true,
          verificationStatus: currentInst.verificationStatus,
        },
        { status: 423 }
      );
    }

    const batchId = crypto.randomUUID();

    // 2. Prepare DRAFT data (NOT applied to institutions table directly)
    // Only track what fields are being changed for suggested_edits records.
    // The institutions table will only have verificationStatus + updatedAt updated.
    const draftData: Record<string, any> = {};

    if (body.name !== undefined) draftData.name = body.name;
    if (body.type !== undefined) draftData.type = body.type;
    if (body.level !== undefined) draftData.level = body.level;
    if (body.status !== undefined) draftData.status = body.status;
    if (body.address !== undefined) draftData.address = body.address;
    if (body.province !== undefined) draftData.province = body.province;
    if (body.city !== undefined) draftData.city = body.city;
    if (body.accreditation !== undefined) draftData.accreditation = body.accreditation;
    if (body.landTotalAreaM2 !== undefined) {
      draftData.landTotalAreaM2 = body.landTotalAreaM2
        ? parseFloat(body.landTotalAreaM2)
        : null;
    }
    if (body.landCertificateStatus !== undefined) {
      draftData.landCertificateStatus = body.landCertificateStatus;
    }
    if (body.landCertificateNumber !== undefined) {
      draftData.landCertificateNumber = body.landCertificateNumber;
    }
    if (body.landUseCategories !== undefined) {
      draftData.landUseCategories = body.landUseCategories;
    }
    if (body.landNjop !== undefined) draftData.landNjop = body.landNjop;
    if (body.landPricePerM2 !== undefined) {
      draftData.landPricePerM2 = body.landPricePerM2;
    }
    if (body.landEstimatedTotalValue !== undefined) {
      draftData.landEstimatedTotalValue = body.landEstimatedTotalValue;
    }
    if (body.notes !== undefined) draftData.notes = body.notes;

    // Polygon coordinates — kept in draftData only, NOT written to institutions
    if (body.landGeometry !== undefined) {
      draftData.landGeometry = body.landGeometry;
    }
    if (body.landParcels !== undefined) {
      draftData.landParcels = body.landParcels;
    }

    if (body.latitude !== undefined && body.longitude !== undefined) {
      const lat = body.latitude ? parseFloat(body.latitude) : null;
      const lng = body.longitude ? parseFloat(body.longitude) : null;
      draftData.latitude = lat;
      draftData.longitude = lng;
    }

    // updateData is ONLY what gets applied to institutions table right now
    // (status + timestamp — NO data fields, NO geometry)
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      verificationStatus: "pengajuan",
    };

    // 3. Detect changes into 2 distinct categories:
    // Category 1: Perubahan Data Institusi
    const FIELD_LABELS: Record<string, string> = {
      name: "Nama Lembaga",
      type: "Jenis Lembaga",
      level: "Jenjang",
      status: "Status",
      address: "Alamat",
      province: "Provinsi",
      city: "Kabupaten / Kota",
      accreditation: "Akreditasi",
      landTotalAreaM2: "Total Luas Tanah (m²)",
      landCertificateStatus: "Status Sertifikat",
      landCertificateNumber: "Nomor Sertifikat",
      landNjop: "NJOP Tanah",
      landPricePerM2: "Harga per m²",
      landEstimatedTotalValue: "Estimasi Nilai Total",
      notes: "Catatan / Keterangan",
      latitude: "Titik Latitude",
      longitude: "Titik Longitude",
    };

    const changedAttributes: Record<string, { label: string; before: any; after: any }> = {};
    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      if (body[key] !== undefined) {
        const oldVal = (currentInst as any)[key];
        const newVal = draftData[key] !== undefined ? draftData[key] : body[key];
        const sOld = oldVal === null || oldVal === undefined ? "" : String(oldVal).trim();
        const sNew = newVal === null || newVal === undefined ? "" : String(newVal).trim();
        if (sOld !== sNew) {
          changedAttributes[key] = {
            label,
            before: oldVal ?? null,
            after: newVal ?? null,
          };
        }
      }
    }

    // Category 2: Perubahan Data Polygon (penambahan, perubahan, atau penghapusan polygon)
    let isPolygonChanged = false;
    let polygonDiff: any = null;
    let prevPolys: any[] = [];
    let nextPolys: any[] = [];

    if (body.landGeometry !== undefined) {
      prevPolys = normalizePolygons(currentInst.landGeometry, currentInst.name);
      nextPolys = normalizePolygons(body.landGeometry, draftData.name || currentInst.name);

      const addedPolys: any[] = [];
      const modifiedPolys: any[] = [];
      const deletedPolys: any[] = [];

      const prevMap = new Map(prevPolys.map((p) => [p.id, p]));
      const nextMap = new Map(nextPolys.map((p) => [p.id, p]));

      for (const np of nextPolys) {
        const op = prevMap.get(np.id);
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
          const isGeomDiff = JSON.stringify(np.coordinates) !== JSON.stringify(op.coordinates);
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
        if (!nextMap.has(op.id)) {
          deletedPolys.push({
            id: op.id,
            name: op.name,
            category: op.category || "kampus",
            area_m2: op.area_m2,
            points_count: op.coordinates?.length || 0,
          });
        }
      }

      if (
        addedPolys.length > 0 ||
        modifiedPolys.length > 0 ||
        deletedPolys.length > 0 ||
        prevPolys.length !== nextPolys.length
      ) {
        isPolygonChanged = true;
        polygonDiff = {
          added: addedPolys,
          modified: modifiedPolys,
          deleted: deletedPolys,
          total_before: prevPolys.length,
          total_after: nextPolys.length,
          total_polygons_before: prevPolys.length,
          total_polygons_after: nextPolys.length,
          total_area_before: prevPolys.reduce((sum, p) => sum + (p.area_m2 || 0), 0),
          total_area_after: nextPolys.reduce((sum, p) => sum + (p.area_m2 || 0), 0),
        };
      }
    }

    // Check if there are ANY actual changes
    if (Object.keys(changedAttributes).length === 0 && !isPolygonChanged) {
      return NextResponse.json(
        {
          error:
            "Tidak ada perubahan data atribut institusi maupun bentuk bidang polygon yang terdeteksi. Silakan lakukan perubahan terlebih dahulu sebelum mengajukan verifikasi ke Admin.",
        },
        { status: 400 }
      );
    }

    // Apply ONLY status change to institutions table — data fields are NOT modified yet.
    // They will be applied upon admin approval via /api/admin/institutions/[id]/approve
    await db
      .update(institutions)
      .set(updateData)
      .where(eq(institutions.id, targetInstId!));

    // 4. Record into suggested_edits according to the 2 categories
    // A. Record Perubahan Data Institusi
    if (Object.keys(changedAttributes).length > 0) {
      const beforeMap = Object.fromEntries(
        Object.entries(changedAttributes).map(([k, v]) => [v.label, v.before])
      );
      const afterMap = Object.fromEntries(
        Object.entries(changedAttributes).map(([k, v]) => [v.label, v.after])
      );

      await db.insert(suggestedEdits).values({
        batchId,
        institutionId: targetInstId,
        institutionName: draftData.name || currentInst.name,
        actionType: "update",
        fieldName: "perubahan_data_institusi",
        currentValue: JSON.stringify(beforeMap),
        suggestedValue: JSON.stringify(afterMap),
        suggestedPayload: {
          category: "perubahan_data_institusi",
          changes: changedAttributes,
          fullData: draftData,
          submittedAt: new Date().toISOString(),
        },
        submitterName: currentUser.name,
        submitterRole: currentUser.role === "admin" || currentUser.role === "super_admin" ? "Admin" : "Institusi",
        submitterEmail: currentUser.username,
        status: "pending",
        createdAt: new Date(),
      });
    }

    // B. Record Perubahan Data Polygon
    if (isPolygonChanged) {
      await db.insert(suggestedEdits).values({
        batchId,
        institutionId: targetInstId,
        institutionName: draftData.name || currentInst.name,
        actionType: "update",
        fieldName: "perubahan_polygon",
        currentValue: JSON.stringify({
          total_polygons: polygonDiff.total_polygons_before,
          total_area_m2: polygonDiff.total_area_before,
          polygons: prevPolys.map((p) => ({
            id: p.id,
            name: p.name,
            area_m2: p.area_m2,
            points_count: p.coordinates?.length || 0,
          })),
        }),
        suggestedValue: JSON.stringify({
          total_polygons: polygonDiff.total_polygons_after,
          total_area_m2: polygonDiff.total_area_after,
          diff: polygonDiff,
        }),
        suggestedGeometry: draftData.landGeometry || null,
        suggestedPayload: {
          category: "perubahan_polygon",
          diff: polygonDiff,
          previousPolygons: prevPolys,
          newPolygons: nextPolys,
          submittedAt: new Date().toISOString(),
        },
        submitterName: currentUser.name,
        submitterRole: currentUser.role === "admin" || currentUser.role === "super_admin" ? "Admin" : "Institusi",
        submitterEmail: currentUser.username,
        status: "pending",
        createdAt: new Date(),
      });
    }

    return NextResponse.json({
      message:
        "Perubahan berhasil diajukan. Status institusi kini 'Pengajuan' dan menunggu verifikasi Admin.",
      verificationStatus: "pengajuan",
      batchId,
      categories: {
        perubahan_data_institusi: Object.keys(changedAttributes).length > 0,
        perubahan_polygon: isPolygonChanged,
      },
    });
  } catch (error: any) {
    console.error("Error updating institution me:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
