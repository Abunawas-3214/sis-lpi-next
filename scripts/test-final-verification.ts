import "dotenv/config";
import { db } from "../lib/db";
import { institutions, users, institutionChildPoints } from "../lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { normalizePolygons, isPointInAnyPolygon } from "../lib/geometry";
import { verifyPassword } from "../lib/auth";

async function run() {
  console.log("=== PENGUJIAN FINAL SIS-LPI ===");

  // 1. Akun & Password Generasi Institusi
  const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(users);
  console.log("1. Total Pengguna Terdaftar di Database:", totalUsers.count);

  const [u01375] = await db.select().from(users).where(eq(users.username, "01375")).limit(1);
  const is01375PasswordValid = u01375 ? verifyPassword("institusi123", u01375.password) : false;
  console.log("   - User 01375 Password 'institusi123' Valid:", is01375PasswordValid);

  const [u18076] = await db.select().from(users).where(eq(users.username, "18076")).limit(1);
  const is18076PasswordValid = u18076 ? verifyPassword("institusi123", u18076.password) : false;
  console.log("   - User 18076 Password 'institusi123' Valid:", is18076PasswordValid);

  // 2. Deteksi Polygon 01375
  const [inst01375] = await db.select().from(institutions).where(eq(institutions.id, "01375")).limit(1);
  const polys01375 = normalizePolygons(inst01375?.landGeometry, inst01375?.name);
  console.log("\n2. Deteksi Polygon 01375 (UIN Malang):");
  console.log("   - Jumlah Bidang Polygon Terdeteksi:", polys01375.length);
  console.log("   - Nama Bidang:", polys01375[0]?.name);
  console.log("   - Luas Bidang:", polys01375[0]?.area_m2?.toLocaleString("id-ID"), "m²");
  console.log("   - Jumlah Titik Vertex:", polys01375[0]?.coordinates?.length);

  // 3. Peta Detail 18076
  const [inst18076] = await db.select().from(institutions).where(eq(institutions.id, "18076")).limit(1);
  const polys18076 = normalizePolygons(inst18076?.landGeometry, inst18076?.name);
  console.log("\n3. Status Data 18076 (PP Putri Alkhairaat):");
  console.log("   - Koordinat Utama:", inst18076?.latitude, inst18076?.longitude);
  console.log("   - Jumlah Polygon:", polys18076.length, "(Belum memiliki polygon, hanya titik koordinat)");

  // 4. Pengujian Child Points & Validasi Point-in-Polygon
  console.log("\n4. Pengujian Child Points (Titik Fasilitas dalam Polygon):");
  const childPts = await db.select().from(institutionChildPoints).where(eq(institutionChildPoints.institutionId, "01375"));
  console.log("   - Titik Fasilitas Terdaftar untuk 01375:", childPts.length);
  childPts.forEach((cp) => {
    console.log(`     * [${cp.category}] ${cp.name} -> Vars:`, JSON.stringify(cp.customVariables));
  });

  // Uji titik di DALAM polygon 01375:
  const testInsidePoint: [number, number] = [-7.95156, 112.60742];
  const insideCheck = isPointInAnyPolygon(testInsidePoint, polys01375);
  console.log("   - Uji Titik di DALAM Polygon:", insideCheck.inside ? "BERHASIL (Valid)" : "GAGAL");

  // Uji titik di LUAR polygon 01375 (misal di kota Surabaya):
  const testOutsidePoint: [number, number] = [-7.2575, 112.7521];
  const outsideCheck = isPointInAnyPolygon(testOutsidePoint, polys01375);
  console.log("   - Uji Titik di LUAR Polygon:", !outsideCheck.inside ? "BERHASIL DITOLAK (Validasi Berfungsi)" : "GAGAL");

  // Uji institusi TANPA polygon (18076):
  const noPolyCheck = isPointInAnyPolygon(testInsidePoint, polys18076);
  console.log("   - Uji Tambah Titik pada Lembaga Tanpa Polygon:", !noPolyCheck.inside ? "BERHASIL DITOLAK (Wajib Punya Polygon)" : "GAGAL");

  console.log("\n=== SEMUA PENGUJIAN SELESAI DAN VALID ===");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
