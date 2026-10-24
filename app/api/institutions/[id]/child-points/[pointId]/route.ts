import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions, institutionChildPoints } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { normalizePolygons, isPointInAnyPolygon } from "@/lib/geometry";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  try {
    const { id, pointId } = await params;
    const ptIdNum = parseInt(pointId);

    if (isNaN(ptIdNum)) {
      return NextResponse.json({ error: "ID titik tidak valid." }, { status: 400 });
    }

    const currentUser = await getSessionUser(request);
    const legacyAdmin = request.cookies.get("admin_session")?.value === "authenticated";

    const isAuthorized =
      legacyAdmin ||
      (currentUser &&
        (currentUser.role === "super_admin" ||
          currentUser.role === "admin" ||
          (currentUser.role === "institusi" && currentUser.institutionId === id)));

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Anda tidak memiliki izin menghapus titik fasilitas ini." },
        { status: 403 }
      );
    }

    const deleted = await db
      .delete(institutionChildPoints)
      .where(
        and(
          eq(institutionChildPoints.id, ptIdNum),
          eq(institutionChildPoints.institutionId, id)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Titik fasilitas tidak ditemukan." },
        { status: 404 }
      );
    }

    // Set institution verification status to 'pengajuan'
    await db
      .update(institutions)
      .set({
        verificationStatus: "pengajuan",
        updatedAt: new Date(),
      })
      .where(eq(institutions.id, id));

    return NextResponse.json({
      message: "Titik fasilitas berhasil dihapus. Status institusi kini menunggu validasi Admin.",
      data: deleted[0],
    });
  } catch (error: any) {
    console.error("Error deleting child point:", error);
    return NextResponse.json(
      { error: "Gagal menghapus titik fasilitas", details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  try {
    const { id, pointId } = await params;
    const ptIdNum = parseInt(pointId);

    if (isNaN(ptIdNum)) {
      return NextResponse.json({ error: "ID titik tidak valid." }, { status: 400 });
    }

    const currentUser = await getSessionUser(request);
    const legacyAdmin = request.cookies.get("admin_session")?.value === "authenticated";

    const isAuthorized =
      legacyAdmin ||
      (currentUser &&
        (currentUser.role === "super_admin" ||
          currentUser.role === "admin" ||
          (currentUser.role === "institusi" && currentUser.institutionId === id)));

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Anda tidak memiliki izin mengubah titik fasilitas ini." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.category !== undefined) updateData.category = body.category.toLowerCase();
    if (body.custom_variables !== undefined) updateData.customVariables = body.custom_variables;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.polygon_id !== undefined) updateData.polygonId = body.polygon_id;
    if (body.polygon_name !== undefined) updateData.polygonName = body.polygon_name;

    if (body.latitude !== undefined || body.longitude !== undefined) {
      const latNum = parseFloat(body.latitude);
      const lngNum = parseFloat(body.longitude);

      if (isNaN(latNum) || isNaN(lngNum)) {
        return NextResponse.json(
          { error: "Koordinat latitude dan longitude tidak valid." },
          { status: 400 }
        );
      }

      // Check point inside polygon
      const [inst] = await db
        .select({
          id: institutions.id,
          name: institutions.name,
          landGeometry: institutions.landGeometry,
        })
        .from(institutions)
        .where(eq(institutions.id, id))
        .limit(1);

      if (inst) {
        const polygons = normalizePolygons(inst.landGeometry, inst.name);
        const pointCheck = isPointInAnyPolygon([latNum, lngNum], polygons);
        if (!pointCheck.inside) {
          return NextResponse.json(
            { error: "Titik baru berada di luar batas bidang polygon institusi." },
            { status: 400 }
          );
        }
      }

      updateData.latitude = latNum;
      updateData.longitude = lngNum;
    }

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(institutionChildPoints)
      .set(updateData)
      .where(
        and(
          eq(institutionChildPoints.id, ptIdNum),
          eq(institutionChildPoints.institutionId, id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Titik fasilitas tidak ditemukan." },
        { status: 404 }
      );
    }

    // Set institution verification status to 'pengajuan'
    await db
      .update(institutions)
      .set({
        verificationStatus: "pengajuan",
        updatedAt: new Date(),
      })
      .where(eq(institutions.id, id));

    return NextResponse.json({
      message: "Titik fasilitas berhasil diperbarui. Status institusi kini menunggu validasi Admin.",
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating child point:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui titik fasilitas", details: error.message },
      { status: 500 }
    );
  }
}
