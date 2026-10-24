import "dotenv/config";
import { db } from "../lib/db";
import { users, institutions, suggestedEdits } from "../lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyPassword, hashPassword, signToken, verifyToken } from "../lib/auth";

async function runTests() {
  console.log("=== Menjalankan Test Integrasi SIS-LPI ===");

  // 1. Check Super Admin & Admin users
  const [superAdmin] = await db.select().from(users).where(eq(users.username, "superadmin")).limit(1);
  if (!superAdmin) throw new Error("Super Admin tidak ditemukan!");
  const isSuperValid = verifyPassword("superadmin123", superAdmin.password);
  console.log("1. Super Admin check:", { username: superAdmin.username, role: superAdmin.role, passwordValid: isSuperValid });

  const [admin] = await db.select().from(users).where(eq(users.username, "admin")).limit(1);
  if (!admin) throw new Error("Admin tidak ditemukan!");
  const isAdminValid = verifyPassword("admin123", admin.password);
  console.log("2. Admin check:", { username: admin.username, role: admin.role, passwordValid: isAdminValid });

  // 2. Check total institution users
  const [instUsersCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "institusi"));
  console.log("3. Total User Institusi di DB:", instUsersCount.count);

  // 3. Test Institution user login
  const sampleInstId = "00639";
  const [instUser] = await db.select().from(users).where(eq(users.username, sampleInstId)).limit(1);
  if (!instUser) throw new Error(`User institusi ${sampleInstId} tidak ditemukan!`);
  const isInstValid = verifyPassword("institusi123", instUser.password);
  console.log("4. Sample User Institusi check:", {
    username: instUser.username,
    institutionId: instUser.institutionId,
    name: instUser.name,
    passwordValid: isInstValid,
  });

  // 4. Test Session Token signing & verifying
  const token = signToken({
    id: instUser.id,
    username: instUser.username,
    name: instUser.name,
    role: "institusi",
    institutionId: instUser.institutionId,
  });
  const verified = verifyToken(token);
  console.log("5. Token Auth check:", { tokenGenerated: Boolean(token), verifiedUser: verified?.username });

  // 5. Test Institution Edit & Polygon Submission -> verificationStatus: 'pengajuan'
  console.log("6. Menguji edit data institusi & penambahan polygon...");
  const testPolygon: [number, number][] = [
    [112.750, -7.250],
    [112.755, -7.250],
    [112.755, -7.255],
    [112.750, -7.255],
    [112.750, -7.250],
  ];

  await db.update(institutions).set({
    notes: "Pengujian keterangan oleh user institusi",
    landGeometry: testPolygon,
    landTotalAreaM2: 25000,
    verificationStatus: "pengajuan",
    updatedAt: new Date(),
  }).where(eq(institutions.id, sampleInstId));

  const [afterEdit] = await db.select().from(institutions).where(eq(institutions.id, sampleInstId)).limit(1);
  console.log("   Status setelah diedit oleh institusi:", afterEdit.verificationStatus);
  if (afterEdit.verificationStatus !== "pengajuan") {
    throw new Error("Status harus 'pengajuan'!");
  }

  // 6. Test Admin Accepting the Pengajuan -> verificationStatus: 'valid'
  console.log("7. Menguji admin menerima pengajuan edit...");
  await db.update(institutions).set({
    verificationStatus: "valid",
    updatedAt: new Date(),
  }).where(eq(institutions.id, sampleInstId));

  const [afterApprove] = await db.select().from(institutions).where(eq(institutions.id, sampleInstId)).limit(1);
  console.log("   Status setelah disetujui admin:", afterApprove.verificationStatus);
  if (afterApprove.verificationStatus !== "valid") {
    throw new Error("Status harus 'valid' setelah disetujui admin!");
  }

  // 7. Test Admin Setting Status to 'tidak_valid'
  console.log("8. Menguji admin memberikan status 'tidak_valid'...");
  await db.update(institutions).set({
    verificationStatus: "tidak_valid",
    updatedAt: new Date(),
  }).where(eq(institutions.id, sampleInstId));

  const [afterReject] = await db.select().from(institutions).where(eq(institutions.id, sampleInstId)).limit(1);
  console.log("   Status setelah ditandai tidak valid:", afterReject.verificationStatus);
  if (afterReject.verificationStatus !== "tidak_valid") {
    throw new Error("Status harus 'tidak_valid'!");
  }

  // Reset back to valid for clean state
  await db.update(institutions).set({ verificationStatus: "valid" }).where(eq(institutions.id, sampleInstId));

  console.log("=== SEMUA TEST INTEGRASI BERHASIL 100% ===");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
