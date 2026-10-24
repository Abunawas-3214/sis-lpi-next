import "dotenv/config";
import { db } from "../lib/db";
import { institutions, users, institutionChildPoints } from "../lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { normalizePolygons } from "../lib/geometry";

async function main() {
  console.log("--- CHECKING 01375 ---");
  const [inst01375] = await db.select().from(institutions).where(eq(institutions.id, "01375")).limit(1);
  if (inst01375) {
    console.log("Name:", inst01375.name);
    console.log("Coords:", inst01375.latitude, inst01375.longitude);
    console.log("landGeometry type:", typeof inst01375.landGeometry);
    console.log("landGeometry isArray:", Array.isArray(inst01375.landGeometry));
    const geomLength = Array.isArray(inst01375.landGeometry) ? inst01375.landGeometry.length : 0;
    console.log("landGeometry point count:", geomLength);
    const normalized = normalizePolygons(inst01375.landGeometry, inst01375.name);
    console.log("Normalized polygons count:", normalized.length);
    if (normalized.length > 0) {
      console.log("First polygon points:", normalized[0].coordinates.length, "Area m2:", normalized[0].area_m2);
    }
  } else {
    console.log("01375 not found!");
  }

  console.log("\n--- CHECKING 18076 ---");
  const [inst18076] = await db.select().from(institutions).where(eq(institutions.id, "18076")).limit(1);
  if (inst18076) {
    console.log("Name:", inst18076.name);
    console.log("Coords:", inst18076.latitude, inst18076.longitude);
    console.log("landGeometry:", inst18076.landGeometry);
  } else {
    console.log("18076 not found!");
  }

  console.log("\n--- CHECKING USERS ---");
  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  console.log("Total users:", userCount.count);
  const [u01375] = await db.select().from(users).where(eq(users.username, "01375")).limit(1);
  console.log("User 01375 exists:", !!u01375, "Role:", u01375?.role);
  const [u18076] = await db.select().from(users).where(eq(users.username, "18076")).limit(1);
  console.log("User 18076 exists:", !!u18076, "Role:", u18076?.role);

  console.log("\n--- CHECKING CHILD POINTS ---");
  const childPts = await db.select().from(institutionChildPoints).where(eq(institutionChildPoints.institutionId, "01375"));
  console.log("Child points for 01375:", childPts.length);
  childPts.forEach(cp => {
    console.log(`- [${cp.category}] ${cp.name} at (${cp.latitude}, ${cp.longitude}), vars:`, JSON.stringify(cp.customVariables));
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
