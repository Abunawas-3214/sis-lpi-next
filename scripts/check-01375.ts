import "dotenv/config";
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const res = await db.execute(sql`
    SELECT id, name, land_total_area_m2, land_geometry IS NOT NULL as has_geom,
           land_parcels IS NOT NULL as has_parcels
    FROM institutions 
    WHERE id = '01375'
  `);
  console.log("01375 row:", res.rows[0]);
  process.exit(0);
}

main().catch(console.error);
