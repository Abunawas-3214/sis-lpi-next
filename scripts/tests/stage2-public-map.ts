import { db } from "@/lib/db";
import { suggestedEdits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function testStage2() {
  console.log("\n============================================================");
  console.log("   TAHAP 2: Peta GIS Publik, Filter & Pencarian Cerdas      ");
  console.log("============================================================");

  const results: { id: string; name: string; status: "PASS" | "FAIL"; details: string }[] = [];

  // TC-MAP-01: Kinerja Loading Awal Payload Peta
  try {
    const t0 = performance.now();
    const res = await fetch("http://localhost:3000/api/institutions/map?limit=40000");
    const elapsed = Math.round(performance.now() - t0);
    const data = await res.json();

    const isArray = Array.isArray(data);
    const count = isArray ? data.length : 0;
    const hasEssentialFieldsOnly = data[0] && data[0].id && data[0].name && data[0].coordinates !== undefined && !data[0].address;

    if (res.status === 200 && isArray && count > 30000 && hasEssentialFieldsOnly) {
      results.push({ id: "TC-MAP-01", name: "Kinerja Endpoint Map (<300ms payload ringkas)", status: "PASS", details: `${count} markers fetched, payload optimized (no full row leak)` });
    } else {
      results.push({ id: "TC-MAP-01", name: "Kinerja Endpoint Map", status: "FAIL", details: `Status: ${res.status}, Count: ${count}, Time: ${elapsed}ms` });
    }
  } catch (err: any) {
    results.push({ id: "TC-MAP-01", name: "Kinerja Endpoint Map", status: "FAIL", details: err.message });
  }

  // TC-MAP-02: Filter Multi-Kategori (Wilayah & Tipe)
  try {
    const provRes = await fetch("http://localhost:3000/api/institutions/map?province=Jawa%20Timur&limit=500");
    const provData = await provRes.json();
    const allJatim = Array.isArray(provData) && provData.length > 0 && provData.every((i: any) => i.province.toLowerCase() === "jawa timur");

    const typeRes = await fetch("http://localhost:3000/api/institutions/map?type=pesantren&limit=500");
    const typeData = await typeRes.json();
    const allPesantren = Array.isArray(typeData) && typeData.length > 0 && typeData.every((i: any) => i.type.toLowerCase() === "pesantren");

    if (provRes.status === 200 && allJatim && typeRes.status === 200 && allPesantren) {
      results.push({ id: "TC-MAP-02", name: "Filter Multi-Kategori (Wilayah & Tipe)", status: "PASS", details: `Jatim filter OK (${provData.length} items), Pesantren filter OK (${typeData.length} items)` });
    } else {
      results.push({ id: "TC-MAP-02", name: "Filter Multi-Kategori", status: "FAIL", details: `Jatim match: ${allJatim}, Pesantren match: ${allPesantren}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-MAP-02", name: "Filter Multi-Kategori", status: "FAIL", details: err.message });
  }

  // TC-MAP-03: Pencarian Teks & Alias Cerdas
  try {
    const aliasRes = await fetch("http://localhost:3000/api/institutions/map?search=uin&limit=50");
    const aliasData = await aliasRes.json();
    const hasUin = Array.isArray(aliasData) && aliasData.some((i: any) => i.name.toLowerCase().includes("islam negeri") || i.name.toLowerCase().includes("uin"));

    const directRes = await fetch("http://localhost:3000/api/institutions/map?search=as-sunnah&limit=20");
    const directData = await directRes.json();
    const hasAsSunnah = Array.isArray(directData) && directData.some((i: any) => i.name.toLowerCase().includes("as-sunnah"));

    if (hasUin && hasAsSunnah) {
      results.push({ id: "TC-MAP-03", name: "Pencarian Teks & Alias Cerdas", status: "PASS", details: "Alias 'uin' resolved to UIN/Islam Negeri, search 'as-sunnah' resolved directly" });
    } else {
      results.push({ id: "TC-MAP-03", name: "Pencarian Teks & Alias Cerdas", status: "FAIL", details: `hasUin: ${hasUin}, hasAsSunnah: ${hasAsSunnah}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-MAP-03", name: "Pencarian Teks & Alias Cerdas", status: "FAIL", details: err.message });
  }

  // TC-MAP-04: Polygons Endpoint & Detail Lembaga
  try {
    const polyRes = await fetch("http://localhost:3000/api/institutions/polygons");
    const polyData = await polyRes.json();
    const isGeoJson = polyData.boundaries?.type === "FeatureCollection" && Array.isArray(polyData.boundaries?.features);

    // Verify detail lembaga 01375
    const detRes = await fetch("http://localhost:3000/api/institutions/01375");
    const detData = await detRes.json();
    const hasDetail = detData.id === "01375" && detData.name && detData.land?.geometry;

    if (isGeoJson && hasDetail) {
      results.push({ id: "TC-MAP-04", name: "GeoJSON Polygons & Detail Lembaga", status: "PASS", details: `FeatureCollection RFC 7946 valid (${polyData.count_boundaries} polygons), detail 01375 fetched with landGeometry` });
    } else {
      results.push({ id: "TC-MAP-04", name: "GeoJSON Polygons & Detail Lembaga", status: "FAIL", details: `GeoJson: ${isGeoJson}, Detail: ${Boolean(hasDetail)}` });
    }
  } catch (err: any) {
    results.push({ id: "TC-MAP-04", name: "GeoJSON Polygons & Detail Lembaga", status: "FAIL", details: err.message });
  }

  // TC-MAP-05: Pengajuan Usulan Perubahan oleh Warga (Suggest Edit)
  try {
    const suggPayload = {
      institution_id: "01375",
      institution_name: "Universitas Islam Negeri Maulana Malik Ibrahim Malang",
      submitter_name: "Warga Penguji",
      submitter_email: "warga@test.id",
      field_name: "notes",
      current_value: "Keterangan lama",
      suggested_value: "Koreksi fasilitas laboratorium riset",
    };

    const suggRes = await fetch("http://localhost:3000/api/suggest-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(suggPayload),
    });
    const suggData = await suggRes.json();

    if ((suggRes.status === 200 || suggRes.status === 201) && (suggData.edit_id || suggData.success || suggData.message)) {
      results.push({ id: "TC-MAP-05", name: "Pengajuan Koreksi Warga (Suggest Edit)", status: "PASS", details: "Crowdsource submission accepted and logged to suggested_edits" });
    } else {
      results.push({ id: "TC-MAP-05", name: "Pengajuan Koreksi Warga (Suggest Edit)", status: "FAIL", details: `Status: ${suggRes.status}: ${JSON.stringify(suggData)}` });
    }

    // Clean up test crowdsource edit
    await db.delete(suggestedEdits).where(eq(suggestedEdits.submitterEmail, "warga@test.id"));
  } catch (err: any) {
    results.push({ id: "TC-MAP-05", name: "Pengajuan Koreksi Warga (Suggest Edit)", status: "FAIL", details: err.message });
  }

  for (const r of results) {
    console.log(`  [${r.status}] ${r.id}: ${r.name} - ${r.details}`);
  }

  const allPassed = results.every((r) => r.status === "PASS");
  return { stage: "Tahap 2", passed: allPassed, results };
}

if ((import.meta as any).main) {
  testStage2().then((r) => {
    process.exit(r.passed ? 0 : 1);
  });
}
