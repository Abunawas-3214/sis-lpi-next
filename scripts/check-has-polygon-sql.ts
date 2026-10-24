import "dotenv/config";
import { db } from "../lib/db";
import { institutions } from "../lib/db/schema";
import { eq, sql } from "drizzle-orm";

async function check() {
  const [row] = await db
    .select({
      id: institutions.id,
      name: institutions.name,
      hasPolygon: sql<boolean>`CASE WHEN ${institutions.landGeometry} IS NOT NULL AND json_array_length(CASE WHEN json_typeof(${institutions.landGeometry}) = 'array' THEN ${institutions.landGeometry} ELSE '[]'::json END) > 2 THEN true ELSE false END`,
      hasParcels: sql<boolean>`CASE WHEN ${institutions.landParcels} IS NOT NULL AND json_array_length(CASE WHEN json_typeof(${institutions.landParcels}) = 'array' THEN ${institutions.landParcels} ELSE '[]'::json END) > 0 THEN true ELSE false END`,
    })
    .from(institutions)
    .where(eq(institutions.id, "01375"));

  console.log("01375 hasPolygon result:", row);
  process.exit(0);
}
check();
