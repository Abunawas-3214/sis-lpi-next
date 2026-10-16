import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { and, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { SEARCH_ALIASES } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get("province");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const level = searchParams.get("level");
    const accreditation = searchParams.get("accreditation");
    const searchRaw = searchParams.get("search")?.trim().toLowerCase();
    const limit = Math.min(parseInt(searchParams.get("limit") || "40000"), 50000);

    const conditions = [
      isNotNull(institutions.latitude),
      isNotNull(institutions.longitude),
    ];

    if (province) {
      conditions.push(eq(institutions.province, province));
    }
    if (type) {
      conditions.push(eq(institutions.type, type));
    }
    if (status) {
      conditions.push(eq(institutions.status, status));
    }
    if (level) {
      conditions.push(eq(institutions.level, level));
    }
    if (accreditation) {
      if (accreditation === "terakreditasi") {
        conditions.push(ilike(institutions.accreditation, "%terakreditasi%"));
      } else if (accreditation === "belum") {
        conditions.push(ilike(institutions.accreditation, "%belum%"));
      } else {
        conditions.push(ilike(institutions.accreditation, `%${accreditation}%`));
      }
    }

    if (searchRaw) {
      const searchTerms = [searchRaw];
      if (SEARCH_ALIASES[searchRaw]) {
        searchTerms.push(...SEARCH_ALIASES[searchRaw]);
      }

      const orClauses = searchTerms.flatMap((term) => [
        ilike(institutions.name, `%${term}%`),
        ilike(institutions.city, `%${term}%`),
        ilike(institutions.address, `%${term}%`),
      ]);

      conditions.push(or(...orClauses)!);
    }

    const rows = await db
      .select({
        id: institutions.id,
        name: institutions.name,
        type: institutions.type,
        level: institutions.level,
        status: institutions.status,
        province: institutions.province,
        city: institutions.city,
        latitude: institutions.latitude,
        longitude: institutions.longitude,
        coordinatePrecision: institutions.coordinatePrecision,
        accreditation: institutions.accreditation,
        landGeometry: institutions.landGeometry,
        landParcels: institutions.landParcels,
      })
      .from(institutions)
      .where(and(...conditions))
      .limit(limit);

    const result = rows.map((r) => {
      const geom = r.landGeometry as any;
      const parcels = r.landParcels as any;
      const has_polygon = Boolean(
        geom && Array.isArray(geom) && geom.length > 3
      );
      const has_parcels = Boolean(
        parcels && Array.isArray(parcels) && parcels.length > 0
      );

      return {
        id: r.id,
        name: r.name,
        type: r.type,
        level: r.level || "unknown",
        status: r.status || "unknown",
        province: r.province,
        city: r.city,
        coordinates: r.latitude && r.longitude ? [r.latitude, r.longitude] : null,
        coordinate_precision: r.coordinatePrecision,
        accreditation: r.accreditation,
        has_polygon,
        has_parcels,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching map markers:", error);
    return NextResponse.json(
      { error: "Failed to fetch institutions map", details: error.message },
      { status: 500 }
    );
  }
}
