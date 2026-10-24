import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions, institutionChildPoints } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { normalizePolygons } from "@/lib/geometry";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [inst] = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, id))
      .limit(1);

    if (!inst) {
      return NextResponse.json(
        { error: "Institution not found" },
        { status: 404 }
      );
    }

    // Determine use_categories if not set
    let useCategories: string[] = [];
    if (inst.landUseCategories && Array.isArray(inst.landUseCategories)) {
      useCategories = inst.landUseCategories as string[];
    } else if (inst.landParcels && Array.isArray(inst.landParcels)) {
      const cats = (inst.landParcels as any[])
        .map((p) => p.category)
        .filter(Boolean);
      useCategories = Array.from(new Set(cats));
    } else {
      if (inst.landUseEducation) useCategories.push("pendidikan");
      if (inst.landUseDormitory) useCategories.push("asrama");
      if (inst.landUseEconomic) useCategories.push("ekonomi");
      if (inst.landUseAgriculture) useCategories.push("pertanian");
      if (inst.landUseWorship) useCategories.push("ibadah");
      if (inst.landUseOther) useCategories.push("lainnya");
    }

    const childPoints = await db
      .select()
      .from(institutionChildPoints)
      .where(eq(institutionChildPoints.institutionId, id));

    const polygons = normalizePolygons(inst.landGeometry, inst.name);

    const data = {
      id: inst.id,
      osm_id: inst.osmId,
      nomor_data_lembaga: inst.nomorDataLembaga,
      name: inst.name,
      type: inst.type,
      level: inst.level || "unknown",
      status: inst.status || "unknown",
      verification_status: inst.verificationStatus || "valid",
      address: inst.address,
      province: inst.province,
      city: inst.city,
      coordinates:
        inst.latitude && inst.longitude ? [inst.latitude, inst.longitude] : null,
      coordinate_precision: inst.coordinatePrecision,
      land: {
        total_area_m2: inst.landTotalAreaM2,
        ownership: inst.landOwnership || [],
        source: inst.landSource,
        geometry: inst.landGeometry,
        polygons: polygons,
        parcels: inst.landParcels || [],
        use_categories: useCategories,
        certificate_status: inst.landCertificateStatus,
        certificate_number: inst.landCertificateNumber,
        use_education: inst.landUseEducation,
        use_dormitory: inst.landUseDormitory,
        use_economic: inst.landUseEconomic,
        use_agriculture: inst.landUseAgriculture,
        use_worship: inst.landUseWorship,
        use_other: inst.landUseOther,
        njop: inst.landNjop,
        price_per_m2: inst.landPricePerM2,
        estimated_total_value: inst.landEstimatedTotalValue,
        valuation_year: inst.landValuationYear,
      },
      child_points: childPoints.map((cp) => ({
        id: cp.id,
        polygon_id: cp.polygonId,
        polygon_name: cp.polygonName,
        name: cp.name,
        category: cp.category,
        latitude: cp.latitude,
        longitude: cp.longitude,
        custom_variables: cp.customVariables,
        notes: cp.notes,
      })),
      osm_tags: inst.osmTags || {},
      accreditation: inst.accreditation,
      emis_category: inst.emisCategory,
      source: inst.source,
      notes: inst.notes,
      created_at: inst.createdAt,
      updated_at: inst.updatedAt,
    };

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching institution detail:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
