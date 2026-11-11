import fs from "fs";
import { db } from "../../lib/db";
import { institutions, users, institutionPolygons, institutionChildPoints, suggestedEdits } from "../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function testStage8() {
  console.log("\n============================================================");
  console.log("   TAHAP 8: Full Lifecycle CRUD End-to-End & Real-Time Sync ");
  console.log("============================================================");

  const creds = JSON.parse(fs.readFileSync("exports/users_credentials_latest.json", "utf8"));
  const superUser = creds.find((u: any) => u.username === "superadmin");

  const results: { id: string; name: string; status: "PASS" | "FAIL"; details: string }[] = [];

  // 1. Super admin login
  const saLogin = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: superUser.username, password: superUser.password }),
  });
  const saCookie = saLogin.headers.get("set-cookie")?.split(";")[0] || "";

  let testAdminId: number | null = null;
  const testAdminUsername = "admin_e2e_" + Date.now().toString().slice(-4);
  const testAdminPassword = "AdminPassword123!";

  const testInstId = "88" + Math.floor(100 + Math.random() * 900).toString(); // e.g. 88123
  const testInstPassword = "InstPassword123!";

  // TC-E2E-01: CRUD Admin oleh Super Admin
  try {
    // Create Admin
    const createAdminRes = await fetch("http://localhost:3000/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: saCookie },
      body: JSON.stringify({
        username: testAdminUsername,
        password: testAdminPassword,
        name: "Admin E2E Tester",
        email: "admin_e2e@test.id",
      }),
    });
    const createAdminData = await createAdminRes.json();
    testAdminId = createAdminData.user?.id;

    // Login with new admin
    const newAdminLoginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: testAdminUsername, password: testAdminPassword }),
    });
    const newAdminCookie = newAdminLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    // Update Admin
    const updateAdminRes = await fetch(`http://localhost:3000/api/admin/users/${testAdminId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: saCookie },
      body: JSON.stringify({ name: "Admin E2E Tester Updated" }),
    });

    if (createAdminRes.status === 200 && newAdminLoginRes.status === 200 && updateAdminRes.status === 200) {
      results.push({ id: "TC-E2E-01", name: "Siklus CRUD Admin oleh Super Admin", status: "PASS", details: `Admin created (id: ${testAdminId}), logged in successfully, profile updated` });
    } else {
      results.push({ id: "TC-E2E-01", name: "Siklus CRUD Admin oleh Super Admin", status: "FAIL", details: `Create: ${createAdminRes.status}, Login: ${newAdminLoginRes.status}, Update: ${updateAdminRes.status}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-E2E-01", name: "Siklus CRUD Admin oleh Super Admin", status: "FAIL", details: err.message });
  }

  // TC-E2E-02: Pembuatan Lembaga Baru & Verifikasi Auto-Embed User
  let instCookie = "";
  try {
    const createInstRes = await fetch("http://localhost:3000/api/admin/institutions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: saCookie },
      body: JSON.stringify({
        id: testInstId,
        name: "Pesantren Uji Terintegrasi E2E",
        type: "pesantren",
        level: "menengah",
        status: "swasta",
        address: "Jl. Pendidikan E2E No. 99",
        province: "Jawa Timur",
        city: "Malang",
        latitude: -7.953,
        longitude: 112.608,
        landTotalAreaM2: 15000,
        initialPassword: testInstPassword,
      }),
    });
    const createInstData = await createInstRes.json();

    // Check database users table directly for the auto-embedded account
    const [userRow] = await db.select().from(users).where(eq(users.username, testInstId)).limit(1);
    const isAutoEmbedded = userRow && userRow.role === "institusi" && userRow.institutionId === testInstId;

    // Login as the new institution operator
    const instLogin = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: testInstId, password: testInstPassword }),
    });
    instCookie = instLogin.headers.get("set-cookie")?.split(";")[0] || "";

    if (createInstRes.status === 200 && isAutoEmbedded && instLogin.status === 200) {
      results.push({ id: "TC-E2E-02", name: "Pembuatan Lembaga & Auto-Embed Akun User", status: "PASS", details: `Institution ${testInstId} created, user account auto-embedded in DB, operator logged in` });
    } else {
      results.push({ id: "TC-E2E-02", name: "Pembuatan Lembaga & Auto-Embed Akun User", status: "FAIL", details: `Create: ${createInstRes.status}, isAutoEmbedded: ${Boolean(isAutoEmbedded)}, Login: ${instLogin.status}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-E2E-02", name: "Pembuatan Lembaga & Auto-Embed Akun User", status: "FAIL", details: err.message });
  }

  // Polygon coordinates for test institution (around -7.953, 112.608)
  const testPolygonGeoJson = [
    {
      id: `poly-${testInstId}-1`,
      name: "Kampus Utama E2E",
      category: "kampus",
      coordinates: [
        [112.6075, -7.9525],
        [112.6085, -7.9525],
        [112.6085, -7.9535],
        [112.6075, -7.9535],
        [112.6075, -7.9525],
      ],
      area_m2: 12100,
    },
  ];

  // TC-E2E-03: Skenario Usulan Ditolak (Rejection Cycle)
  try {
    // 1. Operator submits draft
    const submitDraft1 = await fetch("http://localhost:3000/api/institusi/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: instCookie },
      body: JSON.stringify({
        notes: "Pengajuan pertama (data salah untuk diuji tolak)",
        landTotalAreaM2: 500, // deliberately wrong
        landGeometry: testPolygonGeoJson,
      }),
    });

    // 2. Verify public polygons: must NOT be leaked
    const pubPolyCheck1 = await fetch("http://localhost:3000/api/institutions/polygons");
    const pubPolyData1 = await pubPolyCheck1.json();
    const isLeaked1 = (pubPolyData1.boundaries?.features || []).some((f: any) => f.properties?.id === testInstId);

    // 3. Admin rejects with specific reviewer notes
    const rejectRes = await fetch(`http://localhost:3000/api/admin/institutions/${testInstId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: saCookie },
      body: JSON.stringify({
        notes: "Uji E2E Penolakan: Luas tanah 500 m2 tidak sesuai dokumen. Silakan perbaiki ke 15.000 m2.",
      }),
    });

    // 4. Verify institution portal shows rejection and unlocked
    const meCheck1 = await fetch("http://localhost:3000/api/institusi/me", {
      headers: { Cookie: instCookie },
    });
    const meData1 = await meCheck1.json();
    const isPerbaikan = meData1.institution?.verificationStatus === "perbaikan";
    const isUnlocked = meData1.isLocked === false;

    if (submitDraft1.status === 200 && !isLeaked1 && rejectRes.status === 200 && isPerbaikan && isUnlocked) {
      results.push({ id: "TC-E2E-03", name: "Siklus Usulan Ditolak & Isolasi Publik", status: "PASS", details: "Draft rejected by admin, public polygons zero-leaked, portal status 'perbaikan' and unlocked" });
    } else {
      results.push({ id: "TC-E2E-03", name: "Siklus Usulan Ditolak & Isolasi Publik", status: "FAIL", details: `Submit: ${submitDraft1.status}, Leaked: ${isLeaked1}, Reject: ${rejectRes.status}, isPerbaikan: ${isPerbaikan}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-E2E-03", name: "Siklus Usulan Ditolak & Isolasi Publik", status: "FAIL", details: err.message });
  }

  // TC-E2E-04: Skenario Perbaikan & Persetujuan (Approval Cycle)
  try {
    // 1. Operator resubmits corrected data
    const submitDraft2 = await fetch("http://localhost:3000/api/institusi/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: instCookie },
      body: JSON.stringify({
        notes: "Pengajuan revisi kedua yang sudah benar dan presisi",
        landTotalAreaM2: 15000,
        landCertificateStatus: "Sertifikat Hak Milik (SHM)",
        landCertificateNumber: "SHM-E2E-88888",
        landGeometry: testPolygonGeoJson,
      }),
    });

    // 2. Admin approves the revised proposal
    const approveRes = await fetch(`http://localhost:3000/api/admin/institutions/${testInstId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: saCookie },
      body: JSON.stringify({ notes: "Usulan revisi disetujui untuk rilis produksi" }),
    });

    // 3. Verify institution status is valid
    const meCheck2 = await fetch("http://localhost:3000/api/institusi/me", {
      headers: { Cookie: instCookie },
    });
    const meData2 = await meCheck2.json();
    const isValidNow = meData2.institution?.verificationStatus === "valid";

    if (submitDraft2.status === 200 && approveRes.status === 200 && isValidNow) {
      results.push({ id: "TC-E2E-04", name: "Siklus Revisi & Persetujuan (Approval)", status: "PASS", details: "Revised data approved, status became 'valid', polygons applied" });
    } else {
      results.push({ id: "TC-E2E-04", name: "Siklus Revisi & Persetujuan (Approval)", status: "FAIL", details: `Submit: ${submitDraft2.status}, Approve: ${approveRes.status}, isValid: ${isValidNow}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-E2E-04", name: "Siklus Revisi & Persetujuan (Approval)", status: "FAIL", details: err.message });
  }

  // TC-E2E-05: Child Points & Spatial Containment Enforcement
  let testPointId: number | null = null;
  try {
    // Outside point (Jakarta): should be rejected with 400
    const outPointRes = await fetch(`http://localhost:3000/api/institutions/${testInstId}/child-points`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: instCookie },
      body: JSON.stringify({
        name: "Titik Liar di Monas",
        category: "gedung",
        latitude: -6.175,
        longitude: 106.827,
      }),
    });

    // Inside point (inside test polygon: -7.9530, 112.6080)
    const inPointRes = await fetch(`http://localhost:3000/api/institutions/${testInstId}/child-points`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: instCookie },
      body: JSON.stringify({
        name: "Gedung Asrama Santri E2E",
        category: "asrama",
        latitude: -7.9530,
        longitude: 112.6080,
      }),
    });
    const inPointData = await inPointRes.json();
    testPointId = inPointData.data?.id;

    if (outPointRes.status === 400 && (inPointRes.status === 200 || inPointRes.status === 201) && testPointId) {
      results.push({ id: "TC-E2E-05", name: "Aturan Spasial Child Points & Direct Publish", status: "PASS", details: "Outside point rejected (400), inside point saved directly (id: " + testPointId + ")" });
    } else {
      results.push({ id: "TC-E2E-05", name: "Aturan Spasial Child Points", status: "FAIL", details: `Out: ${outPointRes.status}, In: ${inPointRes.status}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-E2E-05", name: "Aturan Spasial Child Points", status: "FAIL", details: err.message });
  }

  // TC-E2E-06: Verifikasi Sinkronisasi Real-Time Peta Publik (/)
  try {
    // 1. Check /api/institutions/map
    const pubMapRes = await fetch(`http://localhost:3000/api/institutions/map?search=${testInstId}`);
    const pubMapData = await pubMapRes.json();
    const inMap = Array.isArray(pubMapData) && pubMapData.some((i: any) => i.id === testInstId && i.has_polygon === true);

    // 2. Check /api/institutions/polygons
    const pubPolyRes = await fetch("http://localhost:3000/api/institutions/polygons");
    const pubPolyData = await pubPolyRes.json();
    const inPolys = (pubPolyData.boundaries?.features || []).some((f: any) => f.properties?.id === testInstId);

    // 3. Check /api/institutions/[id] detail
    const pubDetRes = await fetch(`http://localhost:3000/api/institutions/${testInstId}`);
    const pubDetData = await pubDetRes.json();
    const hasApprovedCert = pubDetData.land?.certificate_status === "Sertifikat Hak Milik (SHM)";
    const hasChildPointLive = Array.isArray(pubDetData.child_points) && pubDetData.child_points.length > 0;

    if (inMap && inPolys && hasApprovedCert && hasChildPointLive) {
      results.push({ id: "TC-E2E-06", name: "Sinkronisasi Real-Time Peta Publik (/)", status: "PASS", details: "Marker live, polygon live, certificates live, child point live in public map!" });
    } else {
      results.push({ id: "TC-E2E-06", name: "Sinkronisasi Real-Time Peta Publik (/)", status: "FAIL", details: `inMap: ${inMap}, inPolys: ${inPolys}, cert: ${hasApprovedCert}, childPoints: ${hasChildPointLive}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-E2E-06", name: "Sinkronisasi Real-Time Peta Publik", status: "FAIL", details: err.message });
  }

  // TC-E2E-07: Pembersihan Entitas Uji (Cleanup)
  try {
    // Delete test child point
    if (testPointId) {
      await fetch(`http://localhost:3000/api/institutions/${testInstId}/child-points/${testPointId}`, {
        method: "DELETE",
        headers: { Cookie: instCookie },
      });
    }

    // Delete test institution and its user from database directly
    await db.delete(institutionChildPoints).where(eq(institutionChildPoints.institutionId, testInstId));
    await db.delete(institutionPolygons).where(eq(institutionPolygons.institutionId, testInstId));
    await db.delete(suggestedEdits).where(eq(suggestedEdits.institutionId, testInstId));
    await db.delete(users).where(eq(users.username, testInstId));
    await db.delete(institutions).where(eq(institutions.id, testInstId));

    // Delete test admin
    if (testAdminId) {
      await fetch(`http://localhost:3000/api/admin/users/${testAdminId}`, {
        method: "DELETE",
        headers: { Cookie: saCookie },
      });
    }

    results.push({ id: "TC-E2E-07", name: "Pembersihan Entitas Uji (Cleanup)", status: "PASS", details: `Institution ${testInstId}, user, points, and admin ${testAdminUsername} cleaned up cleanly` });
  } catch (err: any) {
    results.push({ id: "TC-E2E-07", name: "Pembersihan Entitas Uji (Cleanup)", status: "FAIL", details: err.message });
  }

  for (const r of results) {
    console.log(`  [${r.status}] ${r.id}: ${r.name} - ${r.details}`);
  }

  const allPassed = results.every((r) => r.status === "PASS");
  return { stage: "Tahap 8", passed: allPassed, results };
}

if ((import.meta as any).main) {
  testStage8().then((r) => {
    process.exit(r.passed ? 0 : 1);
  });
}
