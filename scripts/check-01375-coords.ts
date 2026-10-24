import "dotenv/config";
import { db } from "../lib/db";
import { institutions } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function check() {
  const [inst] = await db.select().from(institutions).where(eq(institutions.id, "01375"));
  const geom = inst.landGeometry as any[];
  console.log("01375 coords (institution latitude, longitude):", inst.latitude, inst.longitude);
  console.log("First 3 points of landGeometry:", geom.slice(0, 3));
  console.log("Last point of landGeometry:", geom[geom.length - 1]);
  process.exit(0);
}
check();
