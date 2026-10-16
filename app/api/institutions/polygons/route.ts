import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { isNotNull, or } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: institutions.id,
        name: institutions.name,
        type: institutions.type,
        landGeometry: institutions.landGeometry,
        landParcels: institutions.landParcels,
      })
      .from(institutions)
      .where(
        or(
          isNotNull(institutions.landGeometry),
          isNotNull(institutions.landParcels)
        )
      );

    const boundaryFeatures: any[] = [];
    const parcelFeatures: any[] = [];

    for (const r of rows) {
      // 1. Outer Land Boundary Polygon
      const geom = r.landGeometry as any;
      if (geom && Array.isArray(geom) && geom.length > 2) {
        boundaryFeatures.push({
          type: "Feature",
          properties: {
            id: r.id,
            name: r.name,
            institution_type: r.type,
            layer_type: "boundary",
          },
          geometry: {
            type: "Polygon",
            coordinates: [geom],
          },
        });
      }

      // 2. Sub-Parcels
      const parcels = r.landParcels as any;
      if (parcels && Array.isArray(parcels)) {
        parcels.forEach((p: any) => {
          if (p.geometry && Array.isArray(p.geometry) && p.geometry.length > 2) {
            parcelFeatures.push({
              type: "Feature",
              properties: {
                id: r.id,
                institution_name: r.name,
                parcel_name: p.name || "Sub-Parcel",
                category: p.category || "lainnya",
                area_m2: p.area_m2 || null,
                layer_type: "parcel",
              },
              geometry: {
                type: "Polygon",
                coordinates: [p.geometry],
              },
            });
          }
        });
      }
    }

    return NextResponse.json({
      boundaries: {
        type: "FeatureCollection",
        features: boundaryFeatures,
      },
      parcels: {
        type: "FeatureCollection",
        features: parcelFeatures,
      },
      count_boundaries: boundaryFeatures.length,
      count_parcels: parcelFeatures.length,
    });
  } catch (error: any) {
    console.error("Error fetching polygons:", error);
    return NextResponse.json(
      { error: "Failed to fetch polygons", details: error.message },
      { status: 500 }
    );
  }
}
