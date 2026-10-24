import "dotenv/config";
import { db } from "../lib/db";
import { institutions } from "../lib/db/schema";
import { isNotNull, or, eq } from "drizzle-orm";
import { normalizePolygons } from "../lib/geometry";

async function check() {
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

  console.log("Total institutions with geometry/parcels:", rows.length);
  for (const r of rows) {
    console.log(`- ID: ${r.id}, Name: ${r.name}`);
    console.log(`  geom isArray: ${Array.isArray(r.landGeometry)}, length: ${Array.isArray(r.landGeometry) ? r.landGeometry.length : 'none'}`);
    const normalized = normalizePolygons(r.landGeometry, r.name);
    console.log(`  normalized polygons count: ${normalized.length}`);
  }
  process.exit(0);
}
check();
