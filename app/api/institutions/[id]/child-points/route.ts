import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions, institutionChildPoints } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { normalizePolygons, isPointInAnyPolygon } from "@/lib/geometry";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const points = await db
      .select()
      .from(institutionChildPoints)
      .where(eq(institutionChildPoints.institutionId, id));

    return NextResponse.json({
      institution_id: id,
      count: points.length,
      data: points.map((p) => ({
        id: p.id,
        institution_id: p.institutionId,
        polygon_id: p.polygonId,
        polygon_name: p.polygonName,
        name: p.name,
        category: p.category,
        latitude: p.latitude,
        longitude: p.longitude,
        custom_variables: p.customVariables,
        notes: p.notes,
        created_at: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching child points:", error);
    return NextResponse.json(
      { error: "Gagal memuat titik fasilitas", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check user auth
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
        { error: "Anda tidak memiliki izin menambah titik fasilitas pada institusi ini." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      category = "umum",
      latitude,
      longitude,
      custom_variables = {},
      notes = "",
      polygon_id,
      polygon_name,
    } = body;

    if (!name || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "Nama titik, latitude, dan longitude wajib diisi." },
        { status: 400 }
      );
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return NextResponse.json(
        { error: "Koordinat latitude dan longitude tidak valid." },
        { status: 400 }
      );
    }

    // Check institution and its polygons
    const [inst] = await db
      .select({
        id: institutions.id,
        name: institutions.name,
        landGeometry: institutions.landGeometry,
      })
      .from(institutions)
      .where(eq(institutions.id, id))
      .limit(1);

    if (!inst) {
      return NextResponse.json(
        { error: "Institusi tidak ditemukan." },
        { status: 404 }
      );
    }

    const polygons = normalizePolygons(inst.landGeometry, inst.name);

    // Rule: Must have polygon!
    if (!polygons || polygons.length === 0) {
      return NextResponse.json(
        {
          error:
            "Institusi belum memiliki batas polygon lahan. Titik fasilitas (child point) hanya dapat ditambahkan jika institusi sudah memiliki polygon.",
        },
        { status: 400 }
      );
    }

    // Rule: Must be inside one of the polygons!
    const pointCheck = isPointInAnyPolygon([latNum, lngNum], polygons);
    if (!pointCheck.inside) {
      return NextResponse.json(
        {
          error:
            "Koordinat titik berada di luar batas polygon institusi. Titik fasilitas harus berada di dalam batas polygon lahan lembaga.",
        },
        { status: 400 }
      );
    }

    const matchedPoly = pointCheck.matchingPolygon;
    const finalPolygonId = polygon_id || matchedPoly?.id || "poly-1";
    const finalPolygonName = polygon_name || matchedPoly?.name || "Bidang Utama";

    const [inserted] = await db
      .insert(institutionChildPoints)
      .values({
        institutionId: id,
        polygonId: finalPolygonId,
        polygonName: finalPolygonName,
        name,
        category: category.toLowerCase(),
        latitude: latNum,
        longitude: lngNum,
        customVariables: custom_variables,
        notes,
      })
      .returning();

    // Mark institution status as 'pengajuan' whenever child points are modified
    await db
      .update(institutions)
      .set({
        verificationStatus: "pengajuan",
        updatedAt: new Date(),
      })
      .where(eq(institutions.id, id));

    return NextResponse.json(
      {
        message: "Titik fasilitas berhasil ditambahkan. Status institusi kini menunggu validasi Admin.",
        data: inserted,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating child point:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan titik fasilitas", details: error.message },
      { status: 500 }
    );
  }
}
