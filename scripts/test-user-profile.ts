import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken, verifyToken } from "../lib/auth";

async function runProfileTests() {
  console.log("=== MEMULAI PENGUJIAN FITUR PROFIL & LOGIN EMAIL ===");

  // 1. Cek user 01375 di DB
  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.username, "01375"))
    .limit(1);

  if (!targetUser) {
    throw new Error("User 01375 tidak ditemukan untuk pengujian");
  }

  console.log(`[PASS] User ditemukan: ${targetUser.name} (${targetUser.username})`);
  const originalEmail = targetUser.email;
  const originalPassword = targetUser.password;

  try {
    // 2. Simulasi update email ke 'operator01375@uin-malang.ac.id'
    const testEmail = "operator01375@uin-malang.ac.id";
    console.log(`\n--- Uji 1: Set Email Profil (${testEmail}) ---`);
    await db
      .update(users)
      .set({ email: testEmail.toLowerCase(), updatedAt: new Date() })
      .where(eq(users.id, targetUser.id));

    // Verifikasi di DB
    const [updated] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUser.id))
      .limit(1);
    console.log(`[PASS] Email tersimpan di DB: ${updated.email}`);

    // 3. Simulasi Login menggunakan EMAIL
    console.log(`\n--- Uji 2: Login Menggunakan Email '${testEmail}' ---`);
    const identifier = testEmail;
    const [loginUserByEmail] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, identifier),
          sql`LOWER(${users.email}) = LOWER(${identifier})`
        )
      )
      .limit(1);

    if (!loginUserByEmail || loginUserByEmail.id !== targetUser.id) {
      throw new Error("Gagal login dengan email!");
    }
    console.log(`[PASS] Berhasil mencocokkan user ID ${loginUserByEmail.id} via email!`);

    // 4. Simulasi Login dengan case-insensitive email (huruf besar-kecil)
    console.log(`\n--- Uji 3: Login Email Case-Insensitive 'OPERATOR01375@UIN-MALANG.AC.ID' ---`);
    const [loginUserCase] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, "OPERATOR01375@UIN-MALANG.AC.ID"),
          sql`LOWER(${users.email}) = LOWER('OPERATOR01375@UIN-MALANG.AC.ID')`
        )
      )
      .limit(1);

    if (!loginUserCase || loginUserCase.id !== targetUser.id) {
      throw new Error("Gagal login dengan email huruf besar-kecil!");
    }
    console.log(`[PASS] Login email case-insensitive berhasil!`);

    // 5. Uji ganti password dengan hash & verifikasi
    console.log(`\n--- Uji 4: Hashing & Verifikasi Kata Sandi Baru ---`);
    const newPass = "PasswordBaru2026!";
    const newHashed = hashPassword(newPass);
    if (!verifyPassword(newPass, newHashed)) {
      throw new Error("Verifikasi kata sandi gagal!");
    }
    console.log(`[PASS] Verifikasi kata sandi baru sukses!`);

    // 6. Uji token session payload yang membawa email
    console.log(`\n--- Uji 5: Token Sesi dengan Payload Email ---`);
    const token = signToken({
      id: updated.id,
      username: updated.username,
      name: updated.name,
      role: updated.role as any,
      institutionId: updated.institutionId,
      email: updated.email,
    });
    const verified = verifyToken(token);
    if (!verified || verified.email !== testEmail) {
      throw new Error("Payload email di token sesi tidak cocok!");
    }
    console.log(`[PASS] Token sesi berhasil didekode dengan email: ${verified.email}`);

  } finally {
    // Kembalikan ke nilai awal
    console.log(`\n--- Rollback: Mengembalikan email dan password awal user 01375 ---`);
    await db
      .update(users)
      .set({
        email: originalEmail,
        password: originalPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUser.id));
    console.log(`[PASS] Database dikembalikan ke status awal dengan aman.`);
  }

  console.log("\n=== SEMUA PENGUJIAN PROFIL & EMAIL LOGIN LULUS 100%! ===");
}

runProfileTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  });
