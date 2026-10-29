import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { isNotNull, or } from "drizzle-orm";
import { normalizePolygons } from "@/lib/geometry";

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
      // 1. Outer Land Boundary Polygon (normalized to support both new multi-polygon array and legacy coordinates)
      const normalized = normalizePolygons(r.landGeometry, r.name);
      for (const poly of normalized) {
        if (poly.coordinates && poly.coordinates.length >= 3) {
          // Ensure closed linear ring for RFC 7946 GeoJSON compliance
          let ring = [...poly.coordinates];
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
            ring.push([first[0], first[1]]);
          }

          boundaryFeatures.push({
            type: "Feature",
            properties: {
              id: r.id,
              name: poly.name || r.name,
              institution_name: r.name,
              institution_type: r.type,
              polygon_id: poly.id,
              area_m2: poly.area_m2,
              layer_type: "boundary",
            },
            geometry: {
              type: "Polygon",
              coordinates: [ring],
            },
          });
        }
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
