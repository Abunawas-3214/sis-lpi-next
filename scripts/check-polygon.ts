import "dotenv/config";
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const res = await db.execute(sql`
    SELECT id, name, land_geometry IS NOT NULL as has_geom, 
           json_typeof(land_geometry) as geom_type,
           json_array_length(CASE WHEN json_typeof(land_geometry) = 'array' THEN land_geometry ELSE '[]'::json END) as geom_len,
           land_parcels
    FROM institutions 
    WHERE id = '01375'
  `);
  console.log("01375 db raw:", res.rows[0]);

  // Check how many institutions have land_geometry or parcels
  const countWithGeom = await db.execute(sql`
    SELECT count(*) FROM institutions WHERE land_geometry IS NOT NULL
  `);
  console.log("Total with land_geometry:", countWithGeom.rows[0]);

  const countWithParcels = await db.execute(sql`
    SELECT count(*) FROM institutions WHERE land_parcels IS NOT NULL
  `);
  console.log("Total with land_parcels:", countWithParcels.rows[0]);

  // Check admin query for 01375
  const adminCheck = await db.execute(sql`
    SELECT id, name,
           CASE WHEN land_geometry IS NOT NULL AND json_array_length(CASE WHEN json_typeof(land_geometry) = 'array' THEN land_geometry ELSE '[]'::json END) > 2 THEN true ELSE false END as has_polygon
    FROM institutions WHERE id = '01375'
  `);
  console.log("Admin check for 01375:", adminCheck.rows[0]);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
