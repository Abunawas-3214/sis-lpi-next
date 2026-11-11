import fs from "fs";
import path from "path";
import crypto from "crypto";
import { promisify } from "util";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { sql, asc } from "drizzle-orm";
import { verifyPassword } from "../lib/auth";

const scryptAsync = promisify(crypto.scrypt);

// Cryptographically secure password generator
// 12 characters alphanumeric (A-Z, a-z, 0-9)
// Contains at least 1 uppercase, 1 lowercase, 1 digit
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude easily confused I, O
const LOWER = "abcdefghijkmnopqrstuvwxyz"; // exclude easily confused l
const DIGITS = "23456789"; // exclude easily confused 0, 1
const ALL_CHARS = UPPER + LOWER + DIGITS;

function generateSecurePassword(length = 12): string {
  const bytes = crypto.randomBytes(length);
  const chars: string[] = [];
  
  // Guarantee at least 1 upper, 1 lower, 1 digit
  chars.push(UPPER[crypto.randomInt(UPPER.length)]);
  chars.push(LOWER[crypto.randomInt(LOWER.length)]);
  chars.push(DIGITS[crypto.randomInt(DIGITS.length)]);

  for (let i = 3; i < length; i++) {
    chars.push(ALL_CHARS[bytes[i] % ALL_CHARS.length]);
  }

  // Shuffle using Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

async function computeScryptHash(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

// Escape CSV field
function toCsvField(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  console.log("======================================================");
  console.log("   SIS-LPI: Mass Random Password Generator & Exporter  ");
  console.log("======================================================");
  const startTime = Date.now();

  // 1. Fetch all users ordered by ID
  console.log("\n[1/6] Fetching all users from database...");
  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      institutionId: users.institutionId,
      email: users.email,
      isActive: users.isActive,
    })
    .from(users)
    .orderBy(asc(users.id));

  const totalUsers = allUsers.length;
  console.log(`Found ${totalUsers} users in database.`);

  if (totalUsers === 0) {
    console.log("No users found. Exiting.");
    process.exit(0);
  }

  // 2. Generate unique passwords for all users
  console.log("\n[2/6] Generating unique secure random passwords...");
  const usedPasswords = new Set<string>();
  const userCredentials: Array<{
    id: number;
    username: string;
    plaintextPassword: string;
    hash: string;
    name: string;
    role: string;
    institutionId: string | null;
    email: string | null;
    isActive: boolean | null;
  }> = [];

  for (const u of allUsers) {
    let pwd = generateSecurePassword(12);
    while (usedPasswords.has(pwd)) {
      pwd = generateSecurePassword(12);
    }
    usedPasswords.add(pwd);

    userCredentials.push({
      id: u.id,
      username: u.username,
      plaintextPassword: pwd,
      hash: "", // will be computed in next step
      name: u.name,
      role: u.role,
      institutionId: u.institutionId,
      email: u.email,
      isActive: u.isActive,
    });
  }
  console.log(`Generated ${userCredentials.length} unique passwords (Set size: ${usedPasswords.size}).`);

  // 3. Compute scrypt hashes in parallel batches
  console.log("\n[3/6] Computing scrypt password hashes (in parallel batches)...");
  const HASH_CONCURRENCY = 200; // 200 concurrent scrypt operations
  let hashedCount = 0;
  const hashStartTime = Date.now();

  for (let i = 0; i < userCredentials.length; i += HASH_CONCURRENCY) {
    const chunk = userCredentials.slice(i, i + HASH_CONCURRENCY);
    await Promise.all(
      chunk.map(async (item) => {
        item.hash = await computeScryptHash(item.plaintextPassword);
      })
    );
    hashedCount += chunk.length;

    if (hashedCount % 2000 === 0 || hashedCount === userCredentials.length) {
      const elapsedSec = ((Date.now() - hashStartTime) / 1000).toFixed(1);
      const percent = ((hashedCount / userCredentials.length) * 100).toFixed(1);
      const rate = (hashedCount / ((Date.now() - hashStartTime) / 1000)).toFixed(0);
      console.log(`  Hashed ${hashedCount}/${userCredentials.length} (${percent}%) - ${elapsedSec}s elapsed (${rate} hashes/sec)`);
    }
  }

  // 4. Update database in batches
  console.log("\n[4/6] Updating users table in database in bulk batches...");
  const DB_BATCH_SIZE = 500;
  let updatedCount = 0;
  const dbStartTime = Date.now();

  for (let i = 0; i < userCredentials.length; i += DB_BATCH_SIZE) {
    const chunk = userCredentials.slice(i, i + DB_BATCH_SIZE);

    // Build parameterized values: ($1, $2), ($3, $4)...
    // In PostgreSQL: UPDATE users AS u SET password = v.pwd, updated_at = NOW() FROM (VALUES ...) AS v(id, pwd) WHERE u.id = v.id
    const valueTuples = chunk.map((c) => `(${c.id}, '${c.hash}')`).join(", ");
    const updateSql = sql.raw(`
      UPDATE users AS u
      SET password = v.pwd,
          updated_at = NOW()
      FROM (VALUES ${valueTuples}) AS v(id, pwd)
      WHERE u.id = v.id;
    `);

    await db.execute(updateSql);
    updatedCount += chunk.length;

    if (updatedCount % 2000 === 0 || updatedCount === userCredentials.length) {
      const elapsedSec = ((Date.now() - dbStartTime) / 1000).toFixed(1);
      const percent = ((updatedCount / userCredentials.length) * 100).toFixed(1);
      console.log(`  Updated DB: ${updatedCount}/${userCredentials.length} (${percent}%) - ${elapsedSec}s`);
    }
  }

  // 5. Verification check
  console.log("\n[5/6] Verifying password integrity on sample accounts...");
  const samples = [
    userCredentials.find((u) => u.username === "superadmin"),
    userCredentials.find((u) => u.username === "admin"),
    userCredentials.find((u) => u.username === "01375"),
    userCredentials.find((u) => u.username === "00639"),
    userCredentials[Math.floor(userCredentials.length / 2)],
  ].filter(Boolean);

  for (const s of samples) {
    if (!s) continue;
    const [row] = await db
      .select({ id: users.id, username: users.username, password: users.password })
      .from(users)
      .where(sql`id = ${s.id}`)
      .limit(1);

    const isValid = verifyPassword(s.plaintextPassword, row.password);
    console.log(`  Verification test [${s.role}] username="${s.username}": ${isValid ? "PASSED (OK)" : "FAILED!"}`);
    if (!isValid) {
      throw new Error(`Integrity verification failed for user ${s.username}`);
    }
  }

  // 6. Export to CSV and JSON
  console.log("\n[6/6] Exporting credentials to CSV and JSON files...");
  const exportDir = path.resolve(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestampStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const csvFileName = `users_credentials_${timestampStr}.csv`;
  const jsonFileName = `users_credentials_${timestampStr}.json`;
  const latestCsvFileName = `users_credentials_latest.csv`;
  const latestJsonFileName = `users_credentials_latest.json`;

  const csvPath = path.join(exportDir, csvFileName);
  const jsonPath = path.join(exportDir, jsonFileName);
  const latestCsvPath = path.join(exportDir, latestCsvFileName);
  const latestJsonPath = path.join(exportDir, latestJsonFileName);

  // Write CSV
  const csvHeader = "id,username,password,name,role,institution_id,email,is_active\n";
  const csvRows = userCredentials.map((u) =>
    [
      u.id,
      toCsvField(u.username),
      toCsvField(u.plaintextPassword),
      toCsvField(u.name),
      toCsvField(u.role),
      toCsvField(u.institutionId),
      toCsvField(u.email),
      u.isActive ? "true" : "false",
    ].join(",")
  );
  fs.writeFileSync(csvPath, csvHeader + csvRows.join("\n"), "utf-8");
  fs.copyFileSync(csvPath, latestCsvPath);

  // Write JSON
  const jsonData = userCredentials.map((u) => ({
    id: u.id,
    username: u.username,
    password: u.plaintextPassword,
    name: u.name,
    role: u.role,
    institution_id: u.institutionId,
    email: u.email,
    is_active: u.isActive,
  }));
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), "utf-8");
  fs.copyFileSync(jsonPath, latestJsonPath);

  const csvStat = fs.statSync(csvPath);
  const jsonStat = fs.statSync(jsonPath);

  const totalElapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n======================================================");
  console.log("   SUCCESS! All user passwords have been updated!     ");
  console.log("======================================================");
  console.log(`Total users processed : ${totalUsers}`);
  console.log(`Total execution time  : ${totalElapsedSec} seconds`);
  console.log(`\nExported Files:`);
  console.log(`- CSV: ${csvPath} (${(csvStat.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`- CSV (latest alias): ${latestCsvPath}`);
  console.log(`- JSON: ${jsonPath} (${(jsonStat.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`- JSON (latest alias): ${latestJsonPath}`);

  // Print sample admin and first institutions
  console.log(`\n--- SAMPLE CREDENTIALS ---`);
  for (const s of samples) {
    if (!s) continue;
    console.log(`Role: ${s.role.padEnd(12)} | Username: ${s.username.padEnd(12)} | Password: ${s.plaintextPassword} | Name: ${s.name}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nFATAL ERROR:", err);
    process.exit(1);
  });
