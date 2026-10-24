import "dotenv/config";
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const res = await db.execute(sql`
    SELECT id, name, type, coordinate_precision, latitude, longitude,
           land_geometry, land_parcels
    FROM institutions 
    WHERE id IN ('01375', '18076')
  `);
  for (const row of res.rows as any[]) {
    console.log("=== ID:", row.id, row.name, "===");
    console.log("coords:", row.latitude, row.longitude);
    console.log("has land_geometry:", Boolean(row.land_geometry), "type:", typeof row.land_geometry);
    if (row.land_geometry) {
      console.log("land_geometry preview:", JSON.stringify(row.land_geometry).slice(0, 200));
    }
    console.log("has land_parcels:", Boolean(row.land_parcels), "type:", typeof row.land_parcels);
    if (row.land_parcels) {
      console.log("land_parcels length:", Array.isArray(row.land_parcels) ? row.land_parcels.length : "not array");
      console.log("land_parcels preview:", JSON.stringify(row.land_parcels).slice(0, 300));
    }
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
