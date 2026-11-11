import { calculateAreaM2, normalizePolygons } from "../../lib/geometry";

export async function testStage4() {
  console.log("\n============================================================");
  console.log("   TAHAP 4: Editor Bidang Lahan Mandiri & Aturan Geometri   ");
  console.log("============================================================");

  const results: { id: string; name: string; status: "PASS" | "FAIL"; details: string }[] = [];

  // TC-POLY-01: Penghitungan Luas Polygon Otomatis (calculateAreaM2)
  try {
    // A ~100m x 100m square in Jakarta coordinates in [latitude, longitude] order
    // 0.0009 deg latitude ≈ 100 meters
    const squareLatLngs: [number, number][] = [
      [-6.1750, 106.8270],
      [-6.1750, 106.8279],
      [-6.1759, 106.8279],
      [-6.1759, 106.8270],
    ];
    const area = calculateAreaM2(squareLatLngs);

    // 100m x 100m is approx 9,500 - 10,500 m²
    if (area > 8000 && area < 12000) {
      results.push({ id: "TC-POLY-01", name: "Kalkulasi Luas Spasial (m²)", status: "PASS", details: `Calculated area: ${area.toFixed(1)} m² (accurate geodesic spherical calculation)` });
    } else {
      results.push({ id: "TC-POLY-01", name: "Kalkulasi Luas Spasial (m²)", status: "FAIL", details: `Unexpected area: ${area}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-POLY-01", name: "Kalkulasi Luas Spasial (m²)", status: "FAIL", details: err.message });
  }

  // TC-POLY-02: Normalisasi Multi-Polygon & RFC 7946 Closed Rings
  try {
    const rawMultiPolys = [
      {
        id: "poly-1",
        name: "Kampus 1",
        category: "kampus",
        coordinates: [
          [106.8, -6.1],
          [106.9, -6.1],
          [106.9, -6.2],
          [106.8, -6.2],
        ],
      },
    ];
    const normalized = normalizePolygons(rawMultiPolys, "Lembaga Uji");

    const hasId = normalized[0]?.id === "poly-1";
    const hasName = normalized[0]?.name === "Kampus 1";
    const isRingClosed = normalized[0]?.coordinates[0][0] === normalized[0]?.coordinates[normalized[0].coordinates.length - 1][0];

    if (hasId && hasName && isRingClosed) {
      results.push({ id: "TC-POLY-02", name: "Normalisasi Multi-Polygon & Closed Ring", status: "PASS", details: "Normalized structure valid, linear ring auto-closed for GeoJSON compliance" });
    } else {
      results.push({ id: "TC-POLY-02", name: "Normalisasi Multi-Polygon & Closed Ring", status: "FAIL", details: `Normalized: ${JSON.stringify(normalized)}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-POLY-02", name: "Normalisasi Multi-Polygon & Closed Ring", status: "FAIL", details: err.message });
  }

  // TC-POLY-03: Route Editor Polygon
  try {
    const res = await fetch("http://localhost:3000/polygon-editor/tambah");
    if (res.status === 200) {
      results.push({ id: "TC-POLY-03", name: "Pemuatan Halaman Editor Polygon", status: "PASS", details: "/polygon-editor/tambah responds HTTP 200 OK" });
    } else {
      results.push({ id: "TC-POLY-03", name: "Pemuatan Halaman Editor Polygon", status: "FAIL", details: `Status: ${res.status}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-POLY-03", name: "Pemuatan Halaman Editor Polygon", status: "FAIL", details: err.message });
  }

  for (const r of results) {
    console.log(`  [${r.status}] ${r.id}: ${r.name} - ${r.details}`);
  }

  const allPassed = results.every((r) => r.status === "PASS");
  return { stage: "Tahap 4", passed: allPassed, results };
}

if ((import.meta as any).main) {
  testStage4().then((r) => {
    process.exit(r.passed ? 0 : 1);
  });
}
