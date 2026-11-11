import fs from "fs";

export async function testStage3() {
  console.log("\n============================================================");
  console.log("   TAHAP 3: Portal Mandiri Institusi & Formulir Profil Lahan");
  console.log("============================================================");

  const creds = JSON.parse(fs.readFileSync("exports/users_credentials_latest.json", "utf8"));
  const instUser = creds.find((u: any) => u.username === "00639");

  const results: { id: string; name: string; status: "PASS" | "FAIL"; details: string }[] = [];

  // Login as 00639
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: instUser.username, password: instUser.password }),
  });
  const cookieHeader = loginRes.headers.get("set-cookie")?.split(";")[0] || "";

  // TC-INST-01: Pemuatan Data Profil Lembaga
  try {
    const meRes = await fetch("http://localhost:3000/api/institusi/me", {
      headers: { Cookie: cookieHeader },
    });
    const meData = await meRes.json();

    const isCorrectInst = meData.institution?.id === "00639";
    const hasHistory = Array.isArray(meData.historyBatches);
    const hasLockField = typeof meData.isLocked === "boolean";

    if (meRes.status === 200 && isCorrectInst && hasHistory && hasLockField) {
      results.push({ id: "TC-INST-01", name: "Pemuatan Profil Institusi (/api/institusi/me)", status: "PASS", details: `ID 00639 profile loaded, isLocked: ${meData.isLocked}, batches: ${meData.historyBatches.length}` });
    } else {
      results.push({ id: "TC-INST-01", name: "Pemuatan Profil Institusi", status: "FAIL", details: `Status: ${meRes.status}, isCorrectInst: ${isCorrectInst}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-INST-01", name: "Pemuatan Profil Institusi", status: "FAIL", details: err.message });
  }

  // TC-INST-03: Penegakan Penguncian Formulir (Auto-Lock HTTP 423)
  // When institution is in status 'pengajuan', sending PUT must return HTTP 423 Locked!
  try {
    // 1. Ensure status is 'pengajuan' by submitting an initial edit if unlocked
    await fetch("http://localhost:3000/api/institusi/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ notes: "Catatan pengajuan untuk mengunci formulir" }),
    });

    // 2. Immediate second PUT while in 'pengajuan' must be blocked with HTTP 423 Locked!
    const lockedAttempt = await fetch("http://localhost:3000/api/institusi/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({
        notes: "Percobaan edit saat terkunci",
        landTotalAreaM2: 99999,
      }),
    });
    const lockedData = await lockedAttempt.json();

    if (lockedAttempt.status === 423) {
      results.push({ id: "TC-INST-03", name: "Penegakan Penguncian Form (HTTP 423 Locked)", status: "PASS", details: "Server rejected mutation while in 'pengajuan' status with HTTP 423 Locked" });
    } else {
      results.push({ id: "TC-INST-03", name: "Penegakan Penguncian Form (HTTP 423 Locked)", status: "FAIL", details: `Expected 423, got ${lockedAttempt.status}: ${JSON.stringify(lockedData)}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-INST-03", name: "Penegakan Penguncian Form (HTTP 423 Locked)", status: "FAIL", details: err.message });
  }

  // TC-INST-04: Tab Riwayat Pengajuan & Catatan Admin
  try {
    const meRes = await fetch("http://localhost:3000/api/institusi/me", {
      headers: { Cookie: cookieHeader },
    });
    const meData = await meRes.json();
    const batches = meData.historyBatches || [];
    const polygonBatch = batches.find((b: any) => b.polygon && b.polygon.diff);

    if (batches.length > 0 && polygonBatch) {
      results.push({ id: "TC-INST-04", name: "Struktur Riwayat Pengajuan & Diff Kategori", status: "PASS", details: `Found ${batches.length} batches, polygon diff presents (added: ${polygonBatch.polygon.diff.added?.length || 0}, modified: ${polygonBatch.polygon.diff.modified?.length || 0})` });
    } else {
      results.push({ id: "TC-INST-04", name: "Struktur Riwayat Pengajuan & Diff Kategori", status: "FAIL", details: `Batches count: ${batches.length}, polygonBatch: ${Boolean(polygonBatch)}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-INST-04", name: "Struktur Riwayat Pengajuan & Diff Kategori", status: "FAIL", details: err.message });
  }

  for (const r of results) {
    console.log(`  [${r.status}] ${r.id}: ${r.name} - ${r.details}`);
  }

  const allPassed = results.every((r) => r.status === "PASS");
  return { stage: "Tahap 3", passed: allPassed, results };
}

if ((import.meta as any).main) {
  testStage3().then((r) => {
    process.exit(r.passed ? 0 : 1);
  });
}
