import fs from "fs";

export async function testStage5() {
  console.log("\n============================================================");
  console.log("   TAHAP 5: Manajemen Titik Fasilitas Gedung (Child Points) ");
  console.log("============================================================");

  const creds = JSON.parse(fs.readFileSync("exports/users_credentials_latest.json", "utf8"));
  const uinUser = creds.find((u: any) => u.username === "01375");

  const results: { id: string; name: string; status: "PASS" | "FAIL"; details: string }[] = [];

  // Login as 01375
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: uinUser.username, password: uinUser.password }),
  });
  const cookieHeader = loginRes.headers.get("set-cookie")?.split(";")[0] || "";

  let createdPointId: number | null = null;

  // TC-CP-01A: Penolakan Titik di LUAR Polygon (Spatial Containment Rejection)
  try {
    const outsideRes = await fetch("http://localhost:3000/api/institutions/01375/child-points", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({
        name: "Titik Liar di Luar Kampus",
        category: "gedung",
        latitude: -6.175, // Jakarta (far away from Malang)
        longitude: 106.827,
      }),
    });
    const outsideData = await outsideRes.json();

    if (outsideRes.status === 400 && outsideData.error?.includes("luar batas polygon")) {
      results.push({ id: "TC-CP-01A", name: "Penolakan Titik di Luar Polygon (Spatial Containment)", status: "PASS", details: "HTTP 400, rejected outside point cleanly" });
    } else {
      results.push({ id: "TC-CP-01A", name: "Penolakan Titik di Luar Polygon", status: "FAIL", details: `Expected 400, got ${outsideRes.status}: ${JSON.stringify(outsideData)}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-CP-01A", name: "Penolakan Titik di Luar Polygon", status: "FAIL", details: err.message });
  }

  // TC-CP-01B: Penerimaan Titik di DALAM Polygon
  try {
    const insideRes = await fetch("http://localhost:3000/api/institutions/01375/child-points", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({
        name: "Gedung Uji Otomatis",
        category: "pendidikan",
        latitude: -7.95156,
        longitude: 112.60742,
        notes: "Uji otomatis tahap 5",
      }),
    });
    const insideData = await insideRes.json();

    if ((insideRes.status === 200 || insideRes.status === 201) && insideData.data?.id) {
      createdPointId = insideData.data.id;
      results.push({ id: "TC-CP-01B", name: "Penyimpanan Titik di Dalam Polygon", status: "PASS", details: `Child point saved with id: ${createdPointId}` });
    } else {
      results.push({ id: "TC-CP-01B", name: "Penyimpanan Titik di Dalam Polygon", status: "FAIL", details: `Status ${insideRes.status}: ${JSON.stringify(insideData)}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-CP-01B", name: "Penyimpanan Titik di Dalam Polygon", status: "FAIL", details: err.message });
  }

  // TC-CP-02: Kebijakan Publikasi Langsung (Direct Publish Rule)
  try {
    const instRes = await fetch("http://localhost:3000/api/institutions/01375");
    const instData = await instRes.json();

    const isStillValid = instData.verification_status === "valid";
    if (isStillValid) {
      results.push({ id: "TC-CP-02", name: "Kebijakan Publikasi Langsung (Direct Publish)", status: "PASS", details: "Status lembaga tetap 'valid', tidak turun menjadi 'pengajuan'" });
    } else {
      results.push({ id: "TC-CP-02", name: "Kebijakan Publikasi Langsung (Direct Publish)", status: "FAIL", details: `verification_status became: ${instData.verification_status}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-CP-02", name: "Kebijakan Publikasi Langsung", status: "FAIL", details: err.message });
  }

  // TC-CP-03: Cleanup point
  if (createdPointId) {
    try {
      const delRes = await fetch(`http://localhost:3000/api/institutions/01375/child-points/${createdPointId}`, {
        method: "DELETE",
        headers: { Cookie: cookieHeader },
      });
      if (delRes.status === 200) {
        results.push({ id: "TC-CP-03", name: "Penghapusan Titik Fasilitas (Cleanup)", status: "PASS", details: `Point ${createdPointId} deleted cleanly` });
      } else {
        results.push({ id: "TC-CP-03", name: "Penghapusan Titik Fasilitas (Cleanup)", status: "FAIL", details: `Status: ${delRes.status}` });
      }
    } catch (err: any) {
      results.push({ id: "TC-CP-03", name: "Penghapusan Titik Fasilitas", status: "FAIL", details: err.message });
    }
  }

  for (const r of results) {
    console.log(`  [${r.status}] ${r.id}: ${r.name} - ${r.details}`);
  }

  const allPassed = results.every((r) => r.status === "PASS");
  return { stage: "Tahap 5", passed: allPassed, results };
}

if ((import.meta as any).main) {
  testStage5().then((r) => {
    process.exit(r.passed ? 0 : 1);
  });
}
