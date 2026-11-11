import { db } from "../lib/db";
import { institutions, users, institutionPolygons, institutionChildPoints, suggestedEdits } from "../lib/db/schema";
import { inArray } from "drizzle-orm";
import fs from "fs";
import path from "path";

const targetIds = ["01424", "01441"];

async function main() {
  console.log("=== PENGHAPUSAN INSTITUSI & AKUN (01424 & 01441) ===");

  // 1. Cek keberadaan di database
  const insts = await db.select().from(institutions).where(inArray(institutions.id, targetIds));
  console.log("Lembaga yang ditemukan:", insts.map((i) => ({ id: i.id, name: i.name })));

  const usrs = await db.select().from(users).where(inArray(users.username, targetIds));
  console.log("Akun pengguna yang ditemukan:", usrs.map((u) => ({ id: u.id, username: u.username, role: u.role })));

  // 2. Hapus relasi child points jika ada
  const delChild = await db.delete(institutionChildPoints).where(inArray(institutionChildPoints.institutionId, targetIds)).returning();
  console.log(`Child points terhapus: ${delChild.length}`);

  // 3. Hapus relasi polygons jika ada
  const delPoly = await db.delete(institutionPolygons).where(inArray(institutionPolygons.institutionId, targetIds)).returning();
  console.log(`Polygons terhapus: ${delPoly.length}`);

  // 4. Hapus relasi suggested edits jika ada
  const delEdits = await db.delete(suggestedEdits).where(inArray(suggestedEdits.institutionId, targetIds)).returning();
  console.log(`Suggested edits terhapus: ${delEdits.length}`);

  // 5. Hapus akun users
  const delUsers = await db.delete(users).where(inArray(users.username, targetIds)).returning();
  console.log(`Akun users terhapus:`, delUsers.map((u) => u.username));

  // 6. Hapus institusi
  const delInst = await db.delete(institutions).where(inArray(institutions.id, targetIds)).returning();
  console.log(`Institusi terhapus:`, delInst.map((i) => ({ id: i.id, name: i.name })));

  // 7. Update CSV
  const csvPath = path.resolve("./exports/users_credentials_latest.csv");
  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, "utf8");
    const lines = csvContent.split("\n");
    const filteredLines = lines.filter((line, idx) => {
      if (idx === 0) return true; // keep header
      const cols = line.split(",");
      const username = cols[1]?.trim();
      const institutionId = cols[5]?.trim();
      return !targetIds.includes(username) && !targetIds.includes(institutionId);
    });
    fs.writeFileSync(csvPath, filteredLines.join("\n"), "utf8");
    console.log(`CSV diperbarui: Sebelumnya ${lines.length} baris -> Sekarang ${filteredLines.length} baris.`);
  }

  // 8. Update JSON
  const jsonPath = path.resolve("./exports/users_credentials_latest.json");
  if (fs.existsSync(jsonPath)) {
    const jsonContent = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const beforeCount = jsonContent.length;
    const filteredJson = jsonContent.filter((u: any) => !targetIds.includes(u.username));
    fs.writeFileSync(jsonPath, JSON.stringify(filteredJson, null, 2), "utf8");
    console.log(`JSON diperbarui: Sebelumnya ${beforeCount} user -> Sekarang ${filteredJson.length} user.`);
  }

  console.log("=== SELESAI DENGAN SUKSES ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
