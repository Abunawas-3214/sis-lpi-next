import "dotenv/config";
import { db } from "../lib/db";
import { institutions } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [inst] = await db.select().from(institutions).where(eq(institutions.id, "01375")).limit(1);
  console.log("01375 landGeometry type:", typeof inst.landGeometry);
  console.log("01375 landGeometry isArray:", Array.isArray(inst.landGeometry));
  console.log("01375 landParcels:", inst.landParcels);
  process.exit(0);
}

main().catch(console.error);
