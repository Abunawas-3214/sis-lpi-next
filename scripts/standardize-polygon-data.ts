import { db } from "../lib/db";
import { institutions, institutionPolygons } from "../lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { normalizePolygons, calculateAreaM2, toLeafletLatLngs } from "../lib/geometry";

async function main() {
  console.log("=== STANDARDIZING POLYGON DATA ===");

  const targetIds = ["01375", "00639", "01405", "04660"];
  const rows = await db
    .select()
    .from(institutions)
    .where(inArray(institutions.id, targetIds));

  for (const row of rows) {
    console.log(`\nProcessing ${row.id} - ${row.name}`);
    const normalized = normalizePolygons(row.landGeometry, row.name || "Lahan Utama LPI");

    // Standardize IDs: ensure they match poly-{id}-X or existing poly IDs
    const standardized = normalized.map((p, idx) => {
      let polyId = p.id;
      if (polyId === "poly-1" || !polyId.includes(row.id)) {
        polyId = `poly-${row.id}-${idx + 1}`;
      }
      const coords = p.coordinates;
      const area = p.area_m2 || calculateAreaM2(toLeafletLatLngs(coords));

      return {
        id: polyId,
        name: p.name || (idx === 0 ? "Lahan Utama LPI" : `Bidang ${idx + 1}`),
        category: p.category || "kampus_utama",
        coordinates: coords,
        area_m2: area,
        notes: p.notes || "",
        child_points: p.child_points || [],
      };
    });

    console.log(`Standardized ${standardized.length} polygon(s) for ${row.id}:`);
    for (const sp of standardized) {
      console.log(`- ${sp.id}: "${sp.name}" (${sp.coordinates.length} points, ${sp.area_m2} m²)`);
    }

    // Update institutions table
    await db
      .update(institutions)
      .set({
        landGeometry: standardized,
        updatedAt: new Date(),
      })
      .where(eq(institutions.id, row.id));

    // Also sync institution_polygons table
    for (const sp of standardized) {
      await db
        .insert(institutionPolygons)
        .values({
          id: sp.id,
          institutionId: row.id,
          name: sp.name,
          coordinates: sp.coordinates,
          areaM2: sp.area_m2,
        })
        .onConflictDoUpdate({
          target: institutionPolygons.id,
          set: {
            name: sp.name,
            coordinates: sp.coordinates,
            areaM2: sp.area_m2,
            updatedAt: new Date(),
          },
        });
    }

    console.log(`Updated institution ${row.id} & synchronized institution_polygons.`);
  }

  console.log("\n=== STANDARDIZATION COMPLETE ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error standardizing polygon data:", err);
  process.exit(1);
});
