import "dotenv/config";
import { db } from "../lib/db";
import { institutions, suggestedEdits, institutionPolygons } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { PUT as updateMePut } from "../app/api/institusi/me/route";
import { GET as getEditsGet } from "../app/api/admin/edits/route";
import { POST as approvePost } from "../app/api/admin/institutions/[id]/approve/route";
import { signToken } from "../lib/auth";
import { NextRequest } from "next/server";
import { normalizePolygons } from "../lib/geometry";

async function main() {
  console.log("==========================================================");
  console.log("PENGUJIAN OPERASI POLYGON PADA INSTITUSI 00639");
  console.log("Penambahan, Perubahan, dan Penghapusan Bidang");
  console.log("==========================================================\n");

  const sessionToken = signToken({
    id: 999,
    username: "00639",
    name: "Pesantren As-Sunnah",
    role: "institusi",
    institutionId: "00639",
  });

  // Reset 00639 to clean baseline: 2 bidang
  const baselinePolygons = [
    {
      id: "poly-00639-1",
      name: "Kampus Utama (Pesantren As-Sunnah)",
      category: "kampus",
      coordinates: [
        [102.10853219032289, -1.538538837810787],
        [102.1086609363556, -1.5377078995623468],
        [102.10926711559297, -1.5379652224093572],
        [102.10931003093721, -1.5386353338444951],
        [102.10859656333923, -1.5398361730095098],
        [102.10813522338869, -1.5394877152857438],
        [102.10824251174927, -1.5391285357262625],
      ],
      area_m2: 16560,
      notes: "",
      child_points: [],
    },
    {
      id: "poly-00639-2",
      name: "Kampus 2 (Lahan Perluasan)",
      category: "kampus",
      coordinates: [
        [102.1105, -1.5385],
        [102.112, -1.5385],
        [102.112, -1.5398],
        [102.1105, -1.5398],
        [102.1105, -1.5385],
      ],
      area_m2: 21500,
      notes: "",
      child_points: [],
    },
  ];

  // Clean pending edits for 00639 before starting test
  await db.delete(suggestedEdits).where(eq(suggestedEdits.institutionId, "00639"));
  await db.update(institutions).set({
    landGeometry: baselinePolygons,
    landTotalAreaM2: 38060,
    verificationStatus: "valid",
    updatedAt: new Date(),
  }).where(eq(institutions.id, "00639"));

  console.log("0. Baseline disiapkan: 2 bidang tanah pada 00639 (Status: valid)");

  // --------------------------------------------------------------------------
  // UJI 1: PENAMBAHAN BIDANG (ADD POLYGON)
  // --------------------------------------------------------------------------
  console.log("\n----------------------------------------------------------");
  console.log("UJI 1: PENAMBAHAN BIDANG BARU (Kampus 3 - Kompleks Olahraga)");
  console.log("----------------------------------------------------------");

  const newPoly3 = {
    id: "poly-00639-3",
    name: "Kampus 3 (Kompleks Sarana Olahraga & Asrama)",
    category: "olahraga",
    coordinates: [
      [102.1130, -1.5380],
      [102.1145, -1.5380],
      [102.1145, -1.5392],
      [102.1130, -1.5392],
      [102.1130, -1.5380],
    ],
    area_m2: 18200,
    notes: "Lahan hibah baru untuk asrama dan fasilitas olahraga santri",
    child_points: [],
  };

  const polysAfterAdd = [...baselinePolygons, newPoly3];
  const totalAreaAfterAdd = polysAfterAdd.reduce((sum, p) => sum + (p.area_m2 || 0), 0);

  const reqAdd = new NextRequest("http://localhost:3000/api/institusi/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: `auth_session=${sessionToken}`,
    },
    body: JSON.stringify({
      landTotalAreaM2: totalAreaAfterAdd,
      landGeometry: polysAfterAdd,
    }),
  });

  const resAdd = await updateMePut(reqAdd);
  const dataAdd = await resAdd.json();
  console.log("   Respon pengajuan:", dataAdd.message);

  // Verifikasi di API Admin (/api/admin/edits)
  const reqAdmin = new NextRequest("http://localhost:3000/api/admin/edits?status=pending", {
    headers: { cookie: "admin_session=authenticated" },
  });
  const resAdmin1 = await getEditsGet(reqAdmin);
  const dataAdmin1 = await resAdmin1.json();
  const grp1 = dataAdmin1.data.find((g: any) => g.institution_id === "00639");

  console.log("   Verifikasi Deteksi Perubahan:");
  console.log("   - Has Polygon Changes:", grp1.polygon.has_changes);
  console.log("   - Total Bidang Awal vs Usulan:", `${grp1.polygon.diff.total_before} → ${grp1.polygon.diff.total_after}`);
  console.log("   - Bidang Yang Ditambahkan (+):", grp1.polygon.diff.added.map((a: any) => `"${a.name}" (${a.area_m2} m²)`));

  if (grp1.polygon.diff.added.length === 0 || grp1.polygon.diff.total_after !== 3) {
    throw new Error("UJI 1 GAGAL: Penambahan bidang tidak terdeteksi dengan benar");
  }
  console.log("   => UJI 1 BERHASIL: Penambahan bidang terdeteksi dengan tepat!");

  // --------------------------------------------------------------------------
  // UJI 2: PERUBAHAN BENTUK & ATRIBUT BIDANG (MODIFY POLYGON)
  // --------------------------------------------------------------------------
  console.log("\n----------------------------------------------------------");
  console.log("UJI 2: PERUBAHAN BENTUK & NAMA BIDANG (Kampus Utama)");
  console.log("----------------------------------------------------------");

  const polysAfterMod = polysAfterAdd.map((p) => {
    if (p.id === "poly-00639-1") {
      return {
        ...p,
        name: "Kampus Utama (Gedung Rektorat & Tarbiyah)",
        area_m2: 17500, // Perubahan luas (+940 m²)
        coordinates: [
          ...p.coordinates.slice(0, 4),
          [102.1095, -1.5390], // Tambah titik vertex
          ...p.coordinates.slice(4),
        ],
      };
    }
    return p;
  });

  const totalAreaAfterMod = polysAfterMod.reduce((sum, p) => sum + (p.area_m2 || 0), 0);

  const reqMod = new NextRequest("http://localhost:3000/api/institusi/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: `auth_session=${sessionToken}`,
    },
    body: JSON.stringify({
      landTotalAreaM2: totalAreaAfterMod,
      landGeometry: polysAfterMod,
    }),
  });

  const resMod = await updateMePut(reqMod);
  const dataMod = await resMod.json();
  console.log("   Respon pengajuan:", dataMod.message);

  const resAdmin2 = await getEditsGet(reqAdmin);
  const dataAdmin2 = await resAdmin2.json();
  const grp2 = dataAdmin2.data.find((g: any) => g.institution_id === "00639");

  console.log("   Verifikasi Deteksi Perubahan:");
  console.log("   - Bidang Yang Dimodifikasi (✎):", grp2.polygon.diff.modified.map((m: any) => ({
    nama_awal: m.before_name,
    nama_usulan: m.after_name,
    luas_awal: `${m.before_area_m2} m²`,
    luas_usulan: `${m.after_area_m2} m²`,
    selisih: `${m.area_diff_m2} m²`,
    titik_awal: m.before_points_count,
    titik_usulan: m.after_points_count,
  })));

  if (grp2.polygon.diff.modified.length === 0) {
    throw new Error("UJI 2 GAGAL: Perubahan bidang tidak terdeteksi");
  }
  console.log("   => UJI 2 BERHASIL: Perubahan bidang terdeteksi dengan tepat!");

  // --------------------------------------------------------------------------
  // UJI 3: PENGHAPUSAN BIDANG (DELETE POLYGON)
  // --------------------------------------------------------------------------
  console.log("\n----------------------------------------------------------");
  console.log("UJI 3: PENGHAPUSAN BIDANG (Hapus Kampus 2 Lahan Perluasan)");
  console.log("----------------------------------------------------------");

  // Hapus poly-00639-2
  const polysAfterDel = polysAfterMod.filter((p) => p.id !== "poly-00639-2");
  const totalAreaAfterDel = polysAfterDel.reduce((sum, p) => sum + (p.area_m2 || 0), 0);

  const reqDel = new NextRequest("http://localhost:3000/api/institusi/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: `auth_session=${sessionToken}`,
    },
    body: JSON.stringify({
      landTotalAreaM2: totalAreaAfterDel,
      landGeometry: polysAfterDel,
    }),
  });

  const resDel = await updateMePut(reqDel);
  const dataDel = await resDel.json();
  console.log("   Respon pengajuan:", dataDel.message);

  const resAdmin3 = await getEditsGet(reqAdmin);
  const dataAdmin3 = await resAdmin3.json();
  const grp3 = dataAdmin3.data.find((g: any) => g.institution_id === "00639");

  console.log("   Verifikasi Deteksi Perubahan:");
  console.log("   - Bidang Yang Dihapus (-):", grp3.polygon.diff.deleted.map((d: any) => `"${d.name}" (${d.area_m2} m²)`));
  console.log("   - Total Bidang Akhir:", grp3.polygon.diff.total_after, "bidang");

  if (grp3.polygon.diff.deleted.length === 0) {
    throw new Error("UJI 3 GAGAL: Penghapusan bidang tidak terdeteksi");
  }
  console.log("   => UJI 3 BERHASIL: Penghapusan bidang terdeteksi dengan tepat!");

  console.log("\n==========================================================");
  console.log("SEMUA PENGUJIAN OPERASI POLYGON PADA 00639 BERHASIL 100%!");
  console.log("==========================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
