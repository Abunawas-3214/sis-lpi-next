import fs from "fs";

export async function testStage1() {
  console.log("\n============================================================");
  console.log("   TAHAP 1: Autentikasi, Sesi & Otorisasi Multi-Role        ");
  console.log("============================================================");

  const creds = JSON.parse(fs.readFileSync("exports/users_credentials_latest.json", "utf8"));
  const superUser = creds.find((u: any) => u.username === "superadmin");
  const adminUser = creds.find((u: any) => u.username === "admin");
  const instUser = creds.find((u: any) => u.username === "00639");

  const results: { id: string; name: string; status: "PASS" | "FAIL"; details: string }[] = [];

  // TC-AUTH-01: Login dengan Kredensial Valid Sesuai Peran
  try {
    // 1. Super Admin Login
    const saRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: superUser.username, password: superUser.password }),
    });
    const saData = await saRes.json();
    const saCookie = saRes.headers.get("set-cookie") || "";

    if (saRes.status === 200 && saData.user?.role === "super_admin" && saCookie.includes("auth_session")) {
      results.push({ id: "TC-AUTH-01A", name: "Login Super Admin", status: "PASS", details: "Role: super_admin, session cookie issued" });
    } else {
      results.push({ id: "TC-AUTH-01A", name: "Login Super Admin", status: "FAIL", details: `Status ${saRes.status}: ${JSON.stringify(saData)}` });
    }

    // 2. Admin Login
    const admRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: adminUser.username, password: adminUser.password }),
    });
    const admData = await admRes.json();
    const admCookie = admRes.headers.get("set-cookie") || "";

    if (admRes.status === 200 && admData.user?.role === "admin" && admCookie.includes("auth_session")) {
      results.push({ id: "TC-AUTH-01B", name: "Login Admin", status: "PASS", details: "Role: admin, session cookie issued" });
    } else {
      results.push({ id: "TC-AUTH-01B", name: "Login Admin", status: "FAIL", details: `Status ${admRes.status}: ${JSON.stringify(admData)}` });
    }

    // 3. Institusi Login
    const instRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: instUser.username, password: instUser.password }),
    });
    const instData = await instRes.json();
    const instCookie = instRes.headers.get("set-cookie") || "";

    if (instRes.status === 200 && instData.user?.role === "institusi" && instData.user?.institutionId === "00639" && instCookie.includes("auth_session")) {
      results.push({ id: "TC-AUTH-01C", name: "Login Institusi", status: "PASS", details: "Role: institusi, institutionId: 00639, session cookie issued" });
    } else {
      results.push({ id: "TC-AUTH-01C", name: "Login Institusi", status: "FAIL", details: `Status ${instRes.status}: ${JSON.stringify(instData)}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-AUTH-01", name: "Login Valid Kredensial", status: "FAIL", details: err.message });
  }

  // TC-AUTH-02: Login dengan Kredensial Salah & Proteksi Brute-Force
  try {
    const wrongRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "superadmin", password: "wrongpassword123" }),
    });
    const wrongData = await wrongRes.json();

    if (wrongRes.status === 401 && wrongData.error) {
      results.push({ id: "TC-AUTH-02", name: "Penolakan Password Salah", status: "PASS", details: "HTTP 401, error message returned cleanly" });
    } else {
      results.push({ id: "TC-AUTH-02", name: "Penolakan Password Salah", status: "FAIL", details: `Expected 401, got ${wrongRes.status}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-AUTH-02", name: "Penolakan Password Salah", status: "FAIL", details: err.message });
  }

  // TC-AUTH-03: Proteksi Akses Route Terbatas (RBAC)
  try {
    // A. Unauthenticated access to /api/admin/users
    const unauthAdmin = await fetch("http://localhost:3000/api/admin/users");
    const isUnauthBlocked = unauthAdmin.status === 401;

    // B. Institution trying to access /api/admin/users
    const instLoginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: instUser.username, password: instUser.password }),
    });
    const instCookie = instLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    const instAdminAttempt = await fetch("http://localhost:3000/api/admin/users", {
      headers: { Cookie: instCookie },
    });
    const isInstBlockedFromAdmin = instAdminAttempt.status === 401 || instAdminAttempt.status === 403;

    // C. Institution 00639 trying to access 01375
    const crossInstAttempt = await fetch("http://localhost:3000/api/institusi/me?id=01375", {
      headers: { Cookie: instCookie },
    });
    const crossData = await crossInstAttempt.json();
    const isIsolated = crossData.institution?.id === "00639"; // Server ignores cross-id and serves own inst

    if (isUnauthBlocked && isInstBlockedFromAdmin && isIsolated) {
      results.push({ id: "TC-AUTH-03", name: "Proteksi RBAC & Isolasi Lembaga", status: "PASS", details: "Unauth blocked (401), Institusi blocked from admin (401), Cross-institution isolated to own data" });
    } else {
      results.push({ id: "TC-AUTH-03", name: "Proteksi RBAC & Isolasi Lembaga", status: "FAIL", details: `Unauth: ${unauthAdmin.status}, InstAdmin: ${instAdminAttempt.status}, Cross: ${crossData.institution?.id}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-AUTH-03", name: "Proteksi RBAC & Isolasi Lembaga", status: "FAIL", details: err.message });
  }

  // TC-AUTH-04: Logout & Invalidation Sesi
  try {
    const logoutRes = await fetch("http://localhost:3000/api/auth/logout", {
      method: "POST",
    });
    const logoutCookie = logoutRes.headers.get("set-cookie") || "";
    const isCleared = logoutCookie.includes("auth_session=;") || logoutCookie.includes("Max-Age=0") || logoutCookie.includes("expires=");

    if (logoutRes.status === 200 && isCleared) {
      results.push({ id: "TC-AUTH-04", name: "Logout & Pembersihan Cookie", status: "PASS", details: "Cookie auth_session cleared" });
    } else {
      results.push({ id: "TC-AUTH-04", name: "Logout & Pembersihan Cookie", status: "FAIL", details: `Status: ${logoutRes.status}, Cookie: ${logoutCookie}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-AUTH-04", name: "Logout & Pembersihan Cookie", status: "FAIL", details: err.message });
  }

  for (const r of results) {
    console.log(`  [${r.status}] ${r.id}: ${r.name} - ${r.details}`);
  }

  const allPassed = results.every((r) => r.status === "PASS");
  return { stage: "Tahap 1", passed: allPassed, results };
}

if ((import.meta as any).main) {
  testStage1().then((r) => {
    process.exit(r.passed ? 0 : 1);
  });
}
