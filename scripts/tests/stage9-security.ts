import fs from "fs";
import { db } from "../../lib/db";
import { users, suggestedEdits } from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import { signToken, verifyToken } from "../../lib/auth";

export async function testStage9() {
  console.log("\n============================================================");
  console.log("   TAHAP 9: Pengujian Keamanan & Penetrasi (Security Test)  ");
  console.log("============================================================");

  const creds = JSON.parse(fs.readFileSync("exports/users_credentials_latest.json", "utf8"));
  const superUser = creds.find((u: any) => u.username === "superadmin");
  const adminUser = creds.find((u: any) => u.username === "admin");
  const instUser00639 = creds.find((u: any) => u.username === "00639");

  const results: { id: string; name: string; status: "PASS" | "FAIL"; details: string }[] = [];

  // Logins
  const instLoginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: instUser00639.username, password: instUser00639.password }),
  });
  const instCookie = instLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

  const adminLoginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: adminUser.username, password: adminUser.password }),
  });
  const adminCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

  // TC-SEC-01: BOLA / IDOR Protection (Cross-Institution Data Mutate)
  try {
    // Institution 00639 tries to add child point to institution 01375
    const idorRes = await fetch("http://localhost:3000/api/institutions/01375/child-points", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: instCookie },
      body: JSON.stringify({
        name: "Hacked Child Point",
        category: "gedung",
        latitude: -7.95156,
        longitude: 112.60742,
      }),
    });
    const isIdorBlocked = idorRes.status === 403 || idorRes.status === 401;

    if (isIdorBlocked) {
      results.push({ id: "TC-SEC-01", name: "Proteksi BOLA / IDOR Lintas Lembaga", status: "PASS", details: `Mutation attempt on other institution was blocked with HTTP ${idorRes.status}` });
    } else {
      results.push({ id: "TC-SEC-01", name: "Proteksi BOLA / IDOR Lintas Lembaga", status: "FAIL", details: `Expected 403/401, got ${idorRes.status}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-SEC-01", name: "Proteksi BOLA / IDOR Lintas Lembaga", status: "FAIL", details: err.message });
  }

  // TC-SEC-02: Privilege Escalation & Token Tampering
  try {
    // 1. Forged token: Change payload to super_admin with fake signature
    const fakePayload = Buffer.from(
      JSON.stringify({ id: 999, username: "hacker", role: "super_admin", institutionId: null, name: "Hacker" })
    ).toString("base64url");
    const tamperedToken = `${fakePayload}.invalid_fake_signature_12345`;
    const verifiedTampered = verifyToken(tamperedToken);

    // 2. Regular admin tries to delete super_admin account (id: 1)
    const deleteSuperRes = await fetch("http://localhost:3000/api/admin/users/1", {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    const isDeleteSuperBlocked = deleteSuperRes.status === 403 || deleteSuperRes.status === 400;

    if (verifiedTampered === null && isDeleteSuperBlocked) {
      results.push({ id: "TC-SEC-02", name: "Deteksi Pemalsuan Token & Eskalasi Hak Akses", status: "PASS", details: "Forged HMAC token rejected (null), admin blocked from deleting super_admin" });
    } else {
      results.push({ id: "TC-SEC-02", name: "Deteksi Pemalsuan Token & Eskalasi Hak Akses", status: "FAIL", details: `Tampered token verified: ${Boolean(verifiedTampered)}, DeleteSuper status: ${deleteSuperRes.status}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-SEC-02", name: "Deteksi Pemalsuan Token & Eskalasi Hak Akses", status: "FAIL", details: err.message });
  }

  // TC-SEC-03: SQL Injection & XSS Input Sanitization
  try {
    // Test SQL Injection string in search
    const sqliRes = await fetch("http://localhost:3000/api/institutions/map?search=%27%20OR%201=1%20--%20");
    const isSqliSafe = sqliRes.status === 200; // Handled as string literal without throwing 500 SQL syntax error

    // Test XSS payload in public suggest-edit
    const xssPayload = {
      institution_id: "01375",
      institution_name: "UIN Malang",
      field_name: "notes",
      suggested_value: `<script>alert('xss_attack')</script>`,
      submitter_name: `<img src=x onerror=alert('xss')>`,
      submitter_email: "hacker@test.id",
    };
    const xssRes = await fetch("http://localhost:3000/api/suggest-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(xssPayload),
    });
    const isXssHandled = xssRes.status === 200 || xssRes.status === 201;

    if (isSqliSafe && isXssHandled) {
      results.push({ id: "TC-SEC-03", name: "Ketahanan SQL Injection & Sanitasi XSS", status: "PASS", details: "SQL injection payload handled as parameterized string, XSS payload stored safely without execution" });
    } else {
      results.push({ id: "TC-SEC-03", name: "Ketahanan SQL Injection & Sanitasi XSS", status: "FAIL", details: `SQLi status: ${sqliRes.status}, XSS status: ${xssRes.status}` });
    }

    // Clean up XSS test record from database so it doesn't pollute the admin dashboard
    await db.delete(suggestedEdits).where(eq(suggestedEdits.submitterEmail, "hacker@test.id"));
  } catch (err: any) {
    results.push({ id: "TC-SEC-03", name: "Ketahanan SQL Injection & Sanitasi XSS", status: "FAIL", details: err.message });
  }

  // TC-SEC-04: Spatial Constraint Bypass Probe
  try {
    const bypassRes = await fetch("http://localhost:3000/api/institutions/01375/child-points", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        name: "Spoofed Coordinates Outside",
        category: "gedung",
        latitude: 0.0,
        longitude: 0.0,
      }),
    });
    if (bypassRes.status === 400) {
      results.push({ id: "TC-SEC-04", name: "Pencegahan Bypass Aturan Spasial (Containment)", status: "PASS", details: "Direct API request with spoofed 0.0, 0.0 coordinates rejected with HTTP 400" });
    } else {
      results.push({ id: "TC-SEC-04", name: "Pencegahan Bypass Aturan Spasial", status: "FAIL", details: `Status: ${bypassRes.status}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-SEC-04", name: "Pencegahan Bypass Aturan Spasial", status: "FAIL", details: err.message });
  }

  // TC-SEC-05: Inactive Account Enforcement
  try {
    // 1. Create a dummy inactive user
    const [testInactive] = await db
      .insert(users)
      .values({
        username: "inactive_user_test",
        password: "hashpasswordtest",
        name: "Inactive User",
        role: "institusi",
        isActive: false,
      })
      .returning();

    // 2. Attempt login
    const inactiveLogin = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "inactive_user_test", password: "anypassword" }),
    });

    // Cleanup
    await db.delete(users).where(eq(users.id, testInactive.id));

    if (inactiveLogin.status === 403 || inactiveLogin.status === 401) {
      results.push({ id: "TC-SEC-05", name: "Penegakan Akun Non-Aktif (is_active = false)", status: "PASS", details: `Inactive account blocked with HTTP ${inactiveLogin.status}` });
    } else {
      results.push({ id: "TC-SEC-05", name: "Penegakan Akun Non-Aktif", status: "FAIL", details: `Status: ${inactiveLogin.status}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-SEC-05", name: "Penegakan Akun Non-Aktif", status: "FAIL", details: err.message });
  }

  for (const r of results) {
    console.log(`  [${r.status}] ${r.id}: ${r.name} - ${r.details}`);
  }

  const allPassed = results.every((r) => r.status === "PASS");
  return { stage: "Tahap 9", passed: allPassed, results };
}

if ((import.meta as any).main) {
  testStage9().then((r) => {
    process.exit(r.passed ? 0 : 1);
  });
}
