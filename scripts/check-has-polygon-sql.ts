import "dotenv/config";
import { db } from "../lib/db";
import { institutions } from "../lib/db/schema";
import { inArray, sql } from "drizzle-orm";

async function check() {
  const targetIds = ["01375", "00639", "01405", "04660", "18076"];
  const rows = await db
    .select({
      id: institutions.id,
      name: institutions.name,
      hasPolygon: sql<boolean>`CASE
        WHEN ${institutions.landGeometry} IS NULL THEN false
        WHEN json_typeof(${institutions.landGeometry}) = 'array' AND json_array_length(${institutions.landGeometry}) = 0 THEN false
        WHEN json_typeof(${institutions.landGeometry}) = 'array' AND json_array_length(${institutions.landGeometry}) > 0 THEN
          CASE
            WHEN json_typeof(${institutions.landGeometry}->0) = 'object' THEN true
            WHEN json_typeof(${institutions.landGeometry}->0) = 'array' AND json_array_length(${institutions.landGeometry}) >= 3 THEN true
            ELSE false
          END
        WHEN json_typeof(${institutions.landGeometry}) = 'object' THEN true
        ELSE false
      END`,
    })
    .from(institutions)
    .where(inArray(institutions.id, targetIds));

  console.log("hasPolygon SQL query result:");
  for (const r of rows) {
    console.log(`- ${r.id} (${r.name}): hasPolygon = ${r.hasPolygon}`);
  }
  process.exit(0);
}
check();
