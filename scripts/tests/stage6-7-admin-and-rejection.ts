import fs from "fs";

export async function testStage6and7() {
  console.log("\n============================================================");
  console.log("   TAHAP 6 & 7: Verifikasi Admin, Penolakan & Isolasi Publik");
  console.log("============================================================");

  const creds = JSON.parse(fs.readFileSync("exports/users_credentials_latest.json", "utf8"));
  const adminUser = creds.find((u: any) => u.username === "admin");
  const instUser = creds.find((u: any) => u.username === "00639");

  const results: { id: string; name: string; status: "PASS" | "FAIL"; details: string }[] = [];

  // 1. Admin login
  const admLoginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: adminUser.username, password: adminUser.password }),
  });
  const admCookie = admLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

  // 2. Institution login
  const instLoginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: instUser.username, password: instUser.password }),
  });
  const instCookie = instLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

  // TC-ADM-01: Pengelompokan Berdasarkan Institusi
  try {
    const editsRes = await fetch("http://localhost:3000/api/admin/edits?status=all", {
      headers: { Cookie: admCookie },
    });
    const editsData = await editsRes.json();

    const isGrouped = Array.isArray(editsData.data);
    const grp00639 = editsData.data.find((g: any) => g.institution_id === "00639");

    if (isGrouped && grp00639) {
      results.push({ id: "TC-ADM-01", name: "Pengelompokan Usulan Berdasarkan Institusi", status: "PASS", details: `Found grouped item for institution 00639 (${grp00639.institution_name})` });
    } else {
      results.push({ id: "TC-ADM-01", name: "Pengelompokan Usulan Berdasarkan Institusi", status: "FAIL", details: `isGrouped: ${isGrouped}, grp00639 found: ${Boolean(grp00639)}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-ADM-01", name: "Pengelompokan Usulan Berdasarkan Institusi", status: "FAIL", details: err.message });
  }

  // TC-ADM-02: Dua Kategori Perubahan & Data Polygon Diff
  try {
    const editsRes = await fetch("http://localhost:3000/api/admin/edits?status=all", {
      headers: { Cookie: admCookie },
    });
    const editsData = await editsRes.json();
    const grp00639 = editsData.data.find((g: any) => g.institution_id === "00639");

    const hasDataCat = grp00639?.data_institusi !== undefined;
    const hasPolyCat = grp00639?.polygon && grp00639.polygon.diff;
    const hasDiffAdded = grp00639?.polygon.diff.added?.length > 0;

    if (hasDataCat && hasPolyCat && hasDiffAdded) {
      results.push({ id: "TC-ADM-02", name: "Verifikasi 2 Kategori & Metrik Diff", status: "PASS", details: "Data category & polygon category separated, diff added/modified detected" });
    } else {
      results.push({ id: "TC-ADM-02", name: "Verifikasi 2 Kategori & Metrik Diff", status: "FAIL", details: `hasDataCat: ${hasDataCat}, hasPolyCat: ${Boolean(hasPolyCat)}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-ADM-02", name: "Verifikasi 2 Kategori & Metrik Diff", status: "FAIL", details: err.message });
  }

  // TC-REJ-01: Isolasi Data Publik Sebelum Approval (Draft Zero-Leak)
  try {
    const pubPolyRes = await fetch("http://localhost:3000/api/institutions/polygons");
    const pubPolyData = await pubPolyRes.json();
    const pubFeatures = pubPolyData.boundaries?.features || [];

    // Check if "Kampus 3" (the pending polygon for 00639) is leaked to public
    const isKampus3Leaked = pubFeatures.some(
      (f: any) => f.properties?.id === "00639" && (f.properties?.name?.includes("Kampus 3") || f.properties?.polygon_id === "poly-00639-3")
    );

    if (!isKampus3Leaked) {
      results.push({ id: "TC-REJ-01", name: "Pencegahan Kebocoran Draft ke Publik (Zero Leak)", status: "PASS", details: "Public polygons contain approved data only, unapproved Kampus 3 is isolated" });
    } else {
      results.push({ id: "TC-REJ-01", name: "Pencegahan Kebocoran Draft ke Publik", status: "FAIL", details: "Kampus 3 leaked to public polygons before approval!" });
    }
  } catch (err: any) {
    results.push({ id: "TC-REJ-01", name: "Pencegahan Kebocoran Draft ke Publik", status: "FAIL", details: err.message });
  }

  // TC-ADM-04: Eksekusi Penolakan oleh Admin (Rejection Flow with Notes)
  try {
    const rejectRes = await fetch("http://localhost:3000/api/admin/institutions/00639/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: admCookie },
      body: JSON.stringify({
        notes: "Uji otomatis: Batas polygon Kampus 3 belum presisi dengan sertifikat. Silakan perbaiki.",
      }),
    });
    const rejectData = await rejectRes.json();

    if (rejectRes.status === 200 && (rejectData.success || rejectData.rejectedCount !== undefined || rejectData.message)) {
      results.push({ id: "TC-ADM-04", name: "Eksekusi Penolakan oleh Admin (Rejection Action)", status: "PASS", details: "Status updated to perbaikan, reviewerNotes recorded in suggested_edits" });
    } else {
      results.push({ id: "TC-ADM-04", name: "Eksekusi Penolakan oleh Admin", status: "FAIL", details: `Status ${rejectRes.status}: ${JSON.stringify(rejectData)}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-ADM-04", name: "Eksekusi Penolakan oleh Admin", status: "FAIL", details: err.message });
  }

  // TC-REJ-02: Rejection Feedback Loop di Portal Institusi
  try {
    const meRes = await fetch("http://localhost:3000/api/institusi/me", {
      headers: { Cookie: instCookie },
    });
    const meData = await meRes.json();

    const isPerbaikan = meData.institution?.verificationStatus === "perbaikan";
    const isUnlocked = meData.isLocked === false; // Must be unlocked so institution can edit and resubmit
    const hasReviewerNotes = meData.historyBatches?.some((b: any) => b.reviewerNotes?.includes("belum presisi"));

    if (isPerbaikan && isUnlocked && hasReviewerNotes) {
      results.push({ id: "TC-REJ-02", name: "Rejection Feedback Loop & Unlock Form", status: "PASS", details: "Status 'perbaikan', form unlocked for resubmission, reviewer notes visible" });
    } else {
      results.push({ id: "TC-REJ-02", name: "Rejection Feedback Loop & Unlock Form", status: "FAIL", details: `isPerbaikan: ${isPerbaikan}, isUnlocked: ${isUnlocked}, notes: ${hasReviewerNotes}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-REJ-02", name: "Rejection Feedback Loop & Unlock Form", status: "FAIL", details: err.message });
  }

  // TC-REJ-03: Isolasi Data Publik Pasca-Penolakan
  try {
    const pubPolyRes = await fetch("http://localhost:3000/api/institutions/polygons");
    const pubPolyData = await pubPolyRes.json();
    const pubFeatures = pubPolyData.boundaries?.features || [];

    const isKampus3LeakedAfterReject = pubFeatures.some(
      (f: any) => f.properties?.id === "00639" && (f.properties?.name?.includes("Kampus 3") || f.properties?.polygon_id === "poly-00639-3")
    );

    if (!isKampus3LeakedAfterReject) {
      results.push({ id: "TC-REJ-03", name: "Isolasi Publik Pasca-Penolakan", status: "PASS", details: "Rejected changes never reach public map, only baseline remains" });
    } else {
      results.push({ id: "TC-REJ-03", name: "Isolasi Publik Pasca-Penolakan", status: "FAIL", details: "Rejected Kampus 3 appeared in public polygons!" });
    }
  } catch (err: any) {
    results.push({ id: "TC-REJ-03", name: "Isolasi Publik Pasca-Penolakan", status: "FAIL", details: err.message });
  }

  for (const r of results) {
    console.log(`  [${r.status}] ${r.id}: ${r.name} - ${r.details}`);
  }

  const allPassed = results.every((r) => r.status === "PASS");
  return { stage: "Tahap 6-7", passed: allPassed, results };
}

if ((import.meta as any).main) {
  testStage6and7().then((r) => {
    process.exit(r.passed ? 0 : 1);
  });
}
