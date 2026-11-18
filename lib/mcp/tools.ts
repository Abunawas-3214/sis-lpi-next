import { z } from "zod";
import { executeReadOnlyQuery } from "./db";
import { expandAliases } from "@/lib/utils";

// ==========================================
// 1. search_institutions
// ==========================================
export const searchInstitutionsSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Kata kunci pencarian untuk nama lembaga, alamat, atau kabupaten/kota"),
  province: z
    .string()
    .optional()
    .describe("Filter berdasarkan nama provinsi (misal: 'JAWA BARAT')"),
  city: z
    .string()
    .optional()
    .describe("Filter berdasarkan nama kabupaten/kota (misal: 'KABUPATEN BOGOR')"),
  type: z
    .string()
    .optional()
    .describe("Filter jenis lembaga (misal: 'pesantren', 'madrasah', 'universitas_islam')"),
  verification_status: z
    .enum(["valid", "pengajuan", "perbaikan"])
    .optional()
    .describe("Filter status verifikasi data lembaga ('valid', 'pengajuan', 'perbaikan')"),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe("Batas jumlah data per halaman (default: 10, maksimal: 50)"),
  offset: z
    .number()
    .min(0)
    .default(0)
    .optional()
    .describe("Offset data untuk pagination (default: 0)"),
});

export async function searchInstitutionsHandler(input: z.infer<typeof searchInstitutionsSchema>) {
  const limit = input.limit ?? 10;
  const offset = input.offset ?? 0;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (input.query && input.query.trim() !== "") {
    const q = `%${input.query.trim()}%`;
    conditions.push(
      `(name ILIKE $${paramIdx} OR address ILIKE $${paramIdx} OR city ILIKE $${paramIdx})`
    );
    params.push(q);
    paramIdx++;
  }

  if (input.province && input.province.trim() !== "") {
    conditions.push(`province ILIKE $${paramIdx}`);
    params.push(`%${input.province.trim()}%`);
    paramIdx++;
  }

  if (input.city && input.city.trim() !== "") {
    conditions.push(`city ILIKE $${paramIdx}`);
    params.push(`%${input.city.trim()}%`);
    paramIdx++;
  }

  if (input.type && input.type.trim() !== "") {
    conditions.push(`type ILIKE $${paramIdx}`);
    params.push(`%${input.type.trim()}%`);
    paramIdx++;
  }

  if (input.verification_status) {
    conditions.push(`verification_status = $${paramIdx}`);
    params.push(input.verification_status);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countSql = `SELECT COUNT(*)::int as total FROM institutions ${whereClause}`;
  const countRows = await executeReadOnlyQuery<{ total: number }>(countSql, params);
  const total = countRows[0]?.total ?? 0;

  const dataParams = [...params, limit, offset];
  const dataSql = `
    SELECT 
      id,
      name,
      type,
      level,
      status,
      address,
      province,
      city,
      latitude,
      longitude,
      land_total_area_m2 AS "landTotalAreaM2",
      land_certificate_status AS "landCertificateStatus",
      verification_status AS "verificationStatus"
    FROM institutions
    ${whereClause}
    ORDER BY name ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const rows = await executeReadOnlyQuery(dataSql, dataParams);

  return {
    total,
    limit,
    offset,
    returned: rows.length,
    institutions: rows,
  };
}

// ==========================================
// 2. get_institution_detail
// ==========================================
export const getInstitutionDetailSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe("ID unik lembaga (misal: '01375')"),
});

export async function getInstitutionDetailHandler(input: z.infer<typeof getInstitutionDetailSchema>) {
  const institutionSql = `
    SELECT 
      id,
      osm_id AS "osmId",
      nomor_data_lembaga AS "nomorDataLembaga",
      name,
      type,
      level,
      status,
      address,
      province,
      city,
      coordinate_precision AS "coordinatePrecision",
      latitude,
      longitude,
      land_total_area_m2 AS "landTotalAreaM2",
      land_ownership AS "landOwnership",
      land_source AS "landSource",
      land_geometry AS "landGeometry",
      land_parcels AS "landParcels",
      land_certificate_status AS "landCertificateStatus",
      land_certificate_number AS "landCertificateNumber",
      land_use_categories AS "landUseCategories",
      land_use_education AS "landUseEducation",
      land_use_dormitory AS "landUseDormitory",
      land_use_economic AS "landUseEconomic",
      land_use_agriculture AS "landUseAgriculture",
      land_use_worship AS "landUseWorship",
      land_use_other AS "landUseOther",
      land_njop AS "landNjop",
      land_price_per_m2 AS "landPricePerM2",
      land_estimated_total_value AS "landEstimatedTotalValue",
      land_valuation_year AS "landValuationYear",
      accreditation,
      emis_category AS "emisCategory",
      osm_tags AS "osmTags",
      source,
      notes,
      verification_status AS "verificationStatus",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM institutions
    WHERE id = $1
    LIMIT 1
  `;

  const institutionRows = await executeReadOnlyQuery(institutionSql, [input.id]);

  if (institutionRows.length === 0) {
    return {
      found: false,
      message: `Institusi dengan ID '${input.id}' tidak ditemukan.`,
      institution: null,
      polygons: [],
      childPoints: [],
    };
  }

  const institution = institutionRows[0];

  const polygonsSql = `
    SELECT 
      id,
      institution_id AS "institutionId",
      name,
      coordinates,
      area_m2 AS "areaM2",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM institution_polygons
    WHERE institution_id = $1
    ORDER BY name ASC
  `;
  const polygons = await executeReadOnlyQuery(polygonsSql, [input.id]);

  const childPointsSql = `
    SELECT 
      id,
      institution_id AS "institutionId",
      polygon_id AS "polygonId",
      polygon_name AS "polygonName",
      name,
      category,
      latitude,
      longitude,
      custom_variables AS "customVariables",
      notes,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM institution_child_points
    WHERE institution_id = $1
    ORDER BY id ASC
  `;
  const childPoints = await executeReadOnlyQuery(childPointsSql, [input.id]);

  return {
    found: true,
    institution,
    polygons,
    childPoints,
  };
}

// ==========================================
// 3. find_institution_by_name
// ==========================================
export const findInstitutionByNameSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe(
      "Nama lembaga atau alias/singkatan (contoh: 'Universitas Islam Negeri Maulana Malik Ibrahim Malang', 'UIN Malang', 'Pondok Pesantren Tebuireng', dll.)"
    ),
  city: z
    .string()
    .optional()
    .describe("Filter kabupaten/kota opsional untuk mempersempit pencarian (contoh: 'Malang')"),
  province: z
    .string()
    .optional()
    .describe("Filter provinsi opsional (contoh: 'Jawa Timur')"),
});

export async function findInstitutionByNameHandler(input: z.infer<typeof findInstitutionByNameSchema>) {
  const rawName = input.name.trim();
  const expandedName = expandAliases(rawName);

  const stopWords = new Set(["dan", "di", "ke", "dari", "yang", "pada"]);
  const tokens = expandedName
    .split(/[\s,.-]+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (tokens.length > 0) {
    const tokenClauses = tokens.map((token) => {
      const idx = paramIdx++;
      params.push(`%${token}%`);
      return `(name ILIKE $${idx} OR city ILIKE $${idx})`;
    });
    conditions.push(`(${tokenClauses.join(" AND ")})`);
  } else {
    params.push(`%${rawName}%`);
    conditions.push(`name ILIKE $${paramIdx++}`);
  }

  if (input.city && input.city.trim() !== "") {
    params.push(`\\y${input.city.trim()}\\y`);
    conditions.push(`city ~* $${paramIdx++}`);
  }

  if (input.province && input.province.trim() !== "") {
    params.push(`%${input.province.trim()}%`);
    conditions.push(`province ILIKE $${paramIdx++}`);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const candidateSql = `
    SELECT 
      id,
      name,
      type,
      level,
      status,
      address,
      province,
      city,
      latitude,
      longitude,
      land_total_area_m2 AS "landTotalAreaM2",
      land_certificate_status AS "landCertificateStatus",
      verification_status AS "verificationStatus"
    FROM institutions
    ${whereClause}
    ORDER BY 
      CASE WHEN name ILIKE '%${rawName.replace(/'/g, "''")}%' THEN 0 ELSE 1 END,
      (land_total_area_m2 IS NOT NULL) DESC,
      name ASC
    LIMIT 5
  `;

  const candidates = await executeReadOnlyQuery(candidateSql, params);

  if (candidates.length === 0) {
    return {
      matched: false,
      message: `Tidak ditemukan lembaga dengan nama '${input.name}'. Coba gunakan kata kunci yang lebih umum.`,
      institution: null,
      polygons: [],
      childPoints: [],
      otherCandidates: [],
    };
  }

  const bestMatch = candidates[0];

  const fullDetailSql = `
    SELECT 
      id,
      osm_id AS "osmId",
      nomor_data_lembaga AS "nomorDataLembaga",
      name,
      type,
      level,
      status,
      address,
      province,
      city,
      coordinate_precision AS "coordinatePrecision",
      latitude,
      longitude,
      land_total_area_m2 AS "landTotalAreaM2",
      land_ownership AS "landOwnership",
      land_source AS "landSource",
      land_geometry AS "landGeometry",
      land_parcels AS "landParcels",
      land_certificate_status AS "landCertificateStatus",
      land_certificate_number AS "landCertificateNumber",
      land_use_categories AS "landUseCategories",
      land_use_education AS "landUseEducation",
      land_use_dormitory AS "landUseDormitory",
      land_use_economic AS "landUseEconomic",
      land_use_agriculture AS "landUseAgriculture",
      land_use_worship AS "landUseWorship",
      land_use_other AS "landUseOther",
      land_njop AS "landNjop",
      land_price_per_m2 AS "landPricePerM2",
      land_estimated_total_value AS "landEstimatedTotalValue",
      land_valuation_year AS "landValuationYear",
      accreditation,
      emis_category AS "emisCategory",
      source,
      notes,
      verification_status AS "verificationStatus",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM institutions
    WHERE id = $1
    LIMIT 1
  `;
  const detailRows = await executeReadOnlyQuery(fullDetailSql, [bestMatch.id]);
  const institution = detailRows[0] || bestMatch;

  const polygonsSql = `
    SELECT 
      id,
      institution_id AS "institutionId",
      name,
      coordinates,
      area_m2 AS "areaM2"
    FROM institution_polygons
    WHERE institution_id = $1
    ORDER BY name ASC
  `;
  const polygons = await executeReadOnlyQuery(polygonsSql, [bestMatch.id]);

  const childPointsSql = `
    SELECT 
      id,
      institution_id AS "institutionId",
      polygon_name AS "polygonName",
      name,
      category,
      latitude,
      longitude,
      custom_variables AS "customVariables",
      notes
    FROM institution_child_points
    WHERE institution_id = $1
    ORDER BY id ASC
  `;
  const childPoints = await executeReadOnlyQuery(childPointsSql, [bestMatch.id]);

  const otherCandidates = candidates.slice(1).map((c: any) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    city: c.city,
    province: c.province,
    landTotalAreaM2: c.landTotalAreaM2,
  }));

  return {
    matched: true,
    institution,
    landSummary: {
      totalAreaM2: institution.landTotalAreaM2 ?? 0,
      totalAreaHectares: institution.landTotalAreaM2 ? +(institution.landTotalAreaM2 / 10000).toFixed(2) : 0,
      certificateStatus: institution.landCertificateStatus,
      ownership: institution.landOwnership,
      polygonsCount: polygons.length,
      childPointsCount: childPoints.length,
    },
    polygons,
    childPoints,
    otherCandidates,
  };
}

// ==========================================
// 4. get_institution_stats
// ==========================================
export const getInstitutionStatsSchema = z.object({
  type: z
    .string()
    .optional()
    .describe("Filter jenis lembaga (misal: 'pesantren', 'madrasah', 'universitas_islam')"),
  city: z
    .string()
    .optional()
    .describe("Filter nama kabupaten/kota (misal: 'Kota Malang', 'Malang', 'Kabupaten Bogor')"),
  province: z
    .string()
    .optional()
    .describe("Filter nama provinsi (misal: 'Jawa Timur', 'Jawa Barat')"),
  status: z
    .enum(["negeri", "swasta"])
    .optional()
    .describe("Filter status lembaga ('negeri' atau 'swasta')"),
  level: z
    .string()
    .optional()
    .describe("Filter jenjang pendidikan ('dasar', 'menengah', 'atas', 'tinggi')"),
  verification_status: z
    .enum(["valid", "pengajuan", "perbaikan"])
    .optional()
    .describe("Filter status verifikasi data lembaga ('valid', 'pengajuan', 'perbaikan')"),
});

export async function getInstitutionStatsHandler(input: z.infer<typeof getInstitutionStatsSchema>) {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (input.type && input.type.trim() !== "") {
    conditions.push(`type ILIKE $${paramIdx++}`);
    params.push(input.type.trim());
  }

  if (input.city && input.city.trim() !== "") {
    conditions.push(`city ~* $${paramIdx++}`);
    params.push(`\\y${input.city.trim()}\\y`);
  }

  if (input.province && input.province.trim() !== "") {
    conditions.push(`province ILIKE $${paramIdx++}`);
    params.push(`%${input.province.trim()}%`);
  }

  if (input.status) {
    conditions.push(`status ILIKE $${paramIdx++}`);
    params.push(input.status);
  }

  if (input.level && input.level.trim() !== "") {
    conditions.push(`level ILIKE $${paramIdx++}`);
    params.push(input.level.trim());
  }

  if (input.verification_status) {
    conditions.push(`verification_status = $${paramIdx++}`);
    params.push(input.verification_status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalSql = `
    SELECT 
      COUNT(*)::int AS total,
      COALESCE(SUM(land_total_area_m2), 0)::float AS "totalLandAreaM2",
      COUNT(CASE WHEN land_total_area_m2 > 0 THEN 1 END)::int AS "institutionsWithLandData"
    FROM institutions
    ${whereClause}
  `;
  const [totalRes] = await executeReadOnlyQuery<{
    total: number;
    totalLandAreaM2: number;
    institutionsWithLandData: number;
  }>(totalSql, params);

  const byTypeSql = `
    SELECT COALESCE(type, 'unknown') as type, COUNT(*)::int as count
    FROM institutions
    ${whereClause}
    GROUP BY type
    ORDER BY count DESC
  `;
  const byType = await executeReadOnlyQuery<{ type: string; count: number }>(byTypeSql, params);

  const byStatusSql = `
    SELECT COALESCE(status, 'unknown') as status, COUNT(*)::int as count
    FROM institutions
    ${whereClause}
    GROUP BY status
    ORDER BY count DESC
  `;
  const byStatus = await executeReadOnlyQuery<{ status: string; count: number }>(byStatusSql, params);

  const byCitySql = `
    SELECT COALESCE(city, 'unknown') as city, COUNT(*)::int as count
    FROM institutions
    ${whereClause}
    GROUP BY city
    ORDER BY count DESC
    LIMIT 10
  `;
  const byCity = await executeReadOnlyQuery<{ city: string; count: number }>(byCitySql, params);

  const sampleSql = `
    SELECT id, name, type, city, province, land_total_area_m2 AS "landTotalAreaM2"
    FROM institutions
    ${whereClause}
    ORDER BY (land_total_area_m2 IS NOT NULL) DESC, name ASC
    LIMIT 3
  `;
  const sampleInstitutions = await executeReadOnlyQuery(sampleSql, params);

  return {
    filterApplied: input,
    totalInstitutions: totalRes?.total ?? 0,
    landStatistics: {
      totalLandAreaM2: Math.round(totalRes?.totalLandAreaM2 ?? 0),
      totalLandAreaHectares: +((totalRes?.totalLandAreaM2 ?? 0) / 10000).toFixed(2),
      institutionsWithLandData: totalRes?.institutionsWithLandData ?? 0,
    },
    breakdownByType: byType,
    breakdownByStatus: byStatus,
    breakdownByCity: byCity,
    sampleInstitutions,
  };
}

// ==========================================
// 5. get_about_info
// ==========================================
export const getAboutInfoSchema = z.object({
  topic: z
    .enum(["all", "vision", "pillars", "features", "governance", "spatial_methodology"])
    .optional()
    .default("all")
    .describe(
      "Topik informasi tentang SIS-LPI yang ingin dibaca ('all', 'vision', 'pillars', 'features', 'governance', 'spatial_methodology')"
    ),
});

export async function getAboutInfoHandler(input: z.infer<typeof getAboutInfoSchema>) {
  const topic = input.topic || "all";

  const overview = {
    title: "Sistem Informasi Spasial Lembaga Pendidikan Islam (SIS-LPI)",
    description:
      "Platform informasi spasial berbasis Web-GIS yang dirancang khusus untuk memetakan, mendokumentasikan, memantau, dan mengoptimalkan aset lahan Lembaga Pendidikan Islam di seluruh Indonesia.",
    framework: "Strategic Adaptive Land Governance terintegrasi prinsip syariah",
  };

  const visionAndBackground = {
    title: "Latar Belakang & Visi",
    summary:
      "Lembaga Pendidikan Islam (Pondok Pesantren, Madrasah, dan PTKI) merupakan pilar strategis pendidikan nasional dengan puluhan ribu titik sebaran serta aset tanah wakaf bernilai sangat tinggi. SIS-LPI hadir untuk menjawab tantangan tata kelola aset spasial yang transparan, akuntabel, dan terintegrasi secara digital.",
    coreValues: [
      {
        name: "Amānah",
        meaning: "Integritas & Akuntabilitas",
        description: "Menjaga dan mengelola tanah wakaf/aset lembaga sebagai titipan suci dengan pendokumentasian legalitas yang sah dan transparan.",
      },
      {
        name: "Khilāfah",
        meaning: "Tanggung Jawab Pemakmuran Bumi",
        description: "Optimalisasi pemanfaatan ruang tanah untuk kemaslahatan pendidikan, dakwah, dan kemandirian ekonomi umat.",
      },
      {
        name: "Mīzān",
        meaning: "Keseimbangan & Keberlanjutan Ekologis",
        description: "Pengelolaan lahan yang memperhatikan keseimbangan lingkungan hidup, ruang terbuka hijau, dan ketahanan iklim.",
      },
    ],
  };

  const pillars = [
    {
      type: "pesantren",
      label: "Pondok Pesantren",
      description: "Pemetaan ponpes salafiyah & modern beserta aset tanah wakaf, asrama santri, dan fasilitas ibadah.",
    },
    {
      type: "madrasah",
      label: "Madrasah (MI, MTs, MA)",
      description: "Inventarisasi madrasah negeri dan swasta dengan data akreditasi, Nomor Data Lembaga (NDL/NPSN), dan jenjang pendidikan dasar hingga menengah.",
    },
    {
      type: "universitas_islam",
      label: "Perguruan Tinggi Keagamaan Islam (PTKI)",
      description: "UIN, IAIN, STAIN, dan perguruan tinggi swasta beserta pemetaan zonasi kampus, fakultas, laboratorium, dan fasilitas akademik.",
    },
  ];

  const features = [
    {
      name: "Marker Clustering Dinamis",
      description: "Pengelompokan puluhan ribu titik sebaran secara otomatis menjadi klaster angka saat zoom out dan memecah menjadi pin individual saat zoom in untuk performa tinggi.",
    },
    {
      name: "Visualisasi Batas Bidang & Zonasi Sub-Parcel",
      description: "Dukungan poligon batas luar tanah (GeoJSON) serta sub-parcel zonasi peruntukan (Pendidikan, Ibadah, Asrama, Olahraga, Pertanian, dll.).",
    },
    {
      name: "Crowdsourced Koreksi Data Publik",
      description: "Masyarakat dan pengelola lembaga dapat mengusulkan pembaharuan data profil, koordinat, dan sertifikat secara partisipatif.",
    },
    {
      name: "Halaman Publik Detail Lembaga (/institutions/[id])",
      description: "Penyajian profil lengkap, peta mini interaktif, sertifikat wakaf, estimasi NJOP/valuasi, poligon bidang tanah, dan titik fasilitas tanpa memerlukan login.",
    },
    {
      name: "Endpoint Terstandarisasi AI Model Context Protocol (/api/mcp)",
      description: "Endpoint remote MCP bawaan untuk mengizinkan agen AI (OpenCode, Claude, Cursor) membaca data publik secara aman dan efisien.",
    },
  ];

  const spatialMethodology = {
    coordinateSystem: "WGS84 (EPSG:4326)",
    precisionLevels: [
      { level: "exact", label: "Exact (OSM)", description: "Titik koordinat presisi tinggi bersumber dari OpenStreetMap atau survei lapangan langsung." },
      { level: "polygon", label: "Batas Poligon", description: "Batas bidang tanah terpetakan lengkap dalam bentuk poligon GeoJSON multi-vertex." },
      { level: "geocoded", label: "Geocoded", description: "Koordinat hasil geocoding berbasis alamat terdaftar lembaga." },
      { level: "city", label: "Tingkat Kota / Kecamatan", description: "Titik aproksimasi berpusat pada wilayah administratif kota/kecamatan lembaga." },
    ],
    supportedFacilityCategories: [
      "gedung",
      "pendidikan",
      "ibadah",
      "asrama",
      "perkantoran",
      "olahraga",
      "laboratorium",
      "umum",
    ],
  };

  if (topic === "vision") return { overview, visionAndBackground };
  if (topic === "pillars") return { overview, pillars };
  if (topic === "features") return { overview, features };
  if (topic === "governance") return { overview, governance: visionAndBackground.coreValues };
  if (topic === "spatial_methodology") return { overview, spatialMethodology };

  return {
    overview,
    visionAndBackground,
    pillars,
    features,
    spatialMethodology,
  };
}

// ==========================================
// 6. get_nearby_institutions
// ==========================================
export const getNearbyInstitutionsSchema = z.object({
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .describe("Garis lintang (latitude) titik pusat pencarian (contoh: -7.9525 untuk Malang)"),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .describe("Garis bujur (longitude) titik pusat pencarian (contoh: 112.6075 untuk Malang)"),
  radius_km: z
    .number()
    .min(0.1)
    .max(100)
    .default(5)
    .optional()
    .describe("Jari-jari pencarian dalam kilometer (default: 5 km, maksimal: 100 km)"),
  type: z
    .string()
    .optional()
    .describe("Filter jenis lembaga (misal: 'pesantren', 'madrasah', 'universitas_islam')"),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe("Maksimal jumlah lembaga terdekat yang dikembalikan (default: 10, maksimal: 50)"),
});

export async function getNearbyInstitutionsHandler(input: z.infer<typeof getNearbyInstitutionsSchema>) {
  const lat = input.latitude;
  const lng = input.longitude;
  const radiusKm = input.radius_km ?? 5;
  const limit = input.limit ?? 10;

  const latDelta = radiusKm / 111.0;
  const lngDelta = radiusKm / (111.0 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));

  const conditions: string[] = [
    "latitude IS NOT NULL",
    "longitude IS NOT NULL",
    "latitude BETWEEN $1 AND $2",
    "longitude BETWEEN $3 AND $4",
  ];
  const params: any[] = [
    lat - latDelta,
    lat + latDelta,
    lng - lngDelta,
    lng + lngDelta,
    lat, // $5
    lng, // $6
    radiusKm, // $7
  ];
  let paramIdx = 8;

  if (input.type && input.type.trim() !== "") {
    conditions.push(`type ILIKE $${paramIdx++}`);
    params.push(input.type.trim());
  }

  const distanceFormula = `
    (6371 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians($5)) * cos(radians(latitude)) *
        cos(radians(longitude) - radians($6)) +
        sin(radians($5)) * sin(radians(latitude))
      ))
    ))
  `;

  conditions.push(`${distanceFormula} <= $7`);

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  params.push(limit);
  const sql = `
    SELECT 
      id,
      name,
      type,
      level,
      status,
      address,
      city,
      province,
      latitude,
      longitude,
      land_total_area_m2 AS "landTotalAreaM2",
      ROUND((${distanceFormula})::numeric, 2)::float AS "distanceKm",
      ROUND(((${distanceFormula}) * 1000)::numeric, 0)::int AS "distanceMeters"
    FROM institutions
    ${whereClause}
    ORDER BY "distanceKm" ASC
    LIMIT $${paramIdx}
  `;

  const rows = await executeReadOnlyQuery(sql, params);

  return {
    origin: {
      latitude: lat,
      longitude: lng,
      radiusKm,
    },
    totalFound: rows.length,
    institutions: rows,
  };
}

// ==========================================
// 7. get_institution_land_polygons
// ==========================================
export const getInstitutionLandPolygonsSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe("ID unik lembaga (contoh: '01375')"),
});

export async function getInstitutionLandPolygonsHandler(
  input: z.infer<typeof getInstitutionLandPolygonsSchema>
) {
  const instSql = `
    SELECT 
      id,
      name,
      type,
      city,
      province,
      latitude,
      longitude,
      coordinate_precision AS "coordinatePrecision",
      land_total_area_m2 AS "landTotalAreaM2",
      land_ownership AS "landOwnership",
      land_certificate_status AS "landCertificateStatus",
      land_certificate_number AS "landCertificateNumber",
      land_use_categories AS "landUseCategories",
      land_njop AS "landNjop",
      land_price_per_m2 AS "landPricePerM2",
      land_estimated_total_value AS "landEstimatedTotalValue"
    FROM institutions
    WHERE id = $1
    LIMIT 1
  `;
  const instRows = await executeReadOnlyQuery(instSql, [input.id]);

  if (instRows.length === 0) {
    return {
      found: false,
      message: `Lembaga dengan ID '${input.id}' tidak ditemukan.`,
      geoJson: null,
      polygons: [],
      childPoints: [],
    };
  }

  const inst = instRows[0];

  const polySql = `
    SELECT 
      id,
      name,
      coordinates,
      area_m2 AS "areaM2",
      created_at AS "createdAt"
    FROM institution_polygons
    WHERE institution_id = $1
    ORDER BY name ASC
  `;
  const polygons = await executeReadOnlyQuery(polySql, [input.id]);

  const childSql = `
    SELECT 
      id,
      polygon_id AS "polygonId",
      polygon_name AS "polygonName",
      name,
      category,
      latitude,
      longitude,
      custom_variables AS "customVariables",
      notes
    FROM institution_child_points
    WHERE institution_id = $1
    ORDER BY id ASC
  `;
  const childPoints = await executeReadOnlyQuery(childSql, [input.id]);

  const features: any[] = [];

  for (const poly of polygons) {
    let coords = Array.isArray(poly.coordinates) ? poly.coordinates : [];
    if (coords.length >= 3) {
      let ring = [...coords];
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
        ring.push([first[0], first[1]]);
      }

      features.push({
        type: "Feature",
        properties: {
          id: poly.id,
          name: poly.name,
          institutionId: inst.id,
          institutionName: inst.name,
          areaM2: poly.areaM2,
          areaHectares: poly.areaM2 ? +(poly.areaM2 / 10000).toFixed(2) : 0,
          featureType: "land_boundary_polygon",
        },
        geometry: {
          type: "Polygon",
          coordinates: [ring],
        },
      });
    }
  }

  for (const pt of childPoints) {
    features.push({
      type: "Feature",
      properties: {
        id: pt.id,
        name: pt.name,
        category: pt.category,
        polygonId: pt.polygonId,
        polygonName: pt.polygonName,
        customVariables: pt.customVariables,
        featureType: "child_facility_point",
      },
      geometry: {
        type: "Point",
        coordinates: [pt.longitude, pt.latitude],
      },
    });
  }

  const geoJson = {
    type: "FeatureCollection",
    features,
  };

  return {
    found: true,
    institution: {
      id: inst.id,
      name: inst.name,
      type: inst.type,
      location: {
        city: inst.city,
        province: inst.province,
        latitude: inst.latitude,
        longitude: inst.longitude,
        coordinatePrecision: inst.coordinatePrecision,
      },
      landSummary: {
        totalAreaM2: inst.landTotalAreaM2 ?? 0,
        totalAreaHectares: inst.landTotalAreaM2 ? +(inst.landTotalAreaM2 / 10000).toFixed(2) : 0,
        polygonsCount: polygons.length,
        childPointsCount: childPoints.length,
        certificateStatus: inst.landCertificateStatus,
        certificateNumber: inst.landCertificateNumber,
        ownership: inst.landOwnership,
        zoningCategories: inst.landUseCategories,
        njop: inst.landNjop,
        pricePerM2: inst.landPricePerM2,
        estimatedTotalValue: inst.landEstimatedTotalValue,
      },
    },
    polygons,
    childPoints,
    geoJson,
  };
}

// ==========================================
// 8. get_provinces_summary
// ==========================================
export const getProvincesSummarySchema = z.object({
  type: z
    .string()
    .optional()
    .describe("Filter jenis lembaga tertentu (misal: 'pesantren', 'madrasah', 'universitas_islam')"),
  sortBy: z
    .enum(["total", "name", "land_area"])
    .optional()
    .default("total")
    .describe("Urutan hasil ('total' terbanyak, 'name' alfabetis, 'land_area' luas lahan terbesar)"),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(38)
    .describe("Batas jumlah provinsi yang dikembalikan (default: 38)"),
});

export async function getProvincesSummaryHandler(input: z.infer<typeof getProvincesSummarySchema>) {
  const sortBy = input.sortBy || "total";
  const limit = input.limit || 38;

  const conditions: string[] = ["province IS NOT NULL", "province != ''"];
  const params: any[] = [];
  let paramIdx = 1;

  if (input.type && input.type.trim() !== "") {
    conditions.push(`type ILIKE $${paramIdx++}`);
    params.push(input.type.trim());
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  let orderClause = `ORDER BY total DESC`;
  if (sortBy === "name") {
    orderClause = `ORDER BY province ASC`;
  } else if (sortBy === "land_area") {
    orderClause = `ORDER BY "totalLandAreaM2" DESC`;
  }

  params.push(limit);
  const sql = `
    SELECT 
      province,
      COUNT(*)::int AS total,
      COUNT(CASE WHEN type = 'pesantren' THEN 1 END)::int AS pesantren,
      COUNT(CASE WHEN type = 'madrasah' THEN 1 END)::int AS madrasah,
      COUNT(CASE WHEN type = 'universitas_islam' THEN 1 END)::int AS "universitasIslam",
      COALESCE(SUM(land_total_area_m2), 0)::float AS "totalLandAreaM2",
      ROUND((COALESCE(SUM(land_total_area_m2), 0) / 10000)::numeric, 2)::float AS "totalLandAreaHectares"
    FROM institutions
    ${whereClause}
    GROUP BY province
    ${orderClause}
    LIMIT $${paramIdx}
  `;

  const rows = await executeReadOnlyQuery(sql, params);

  const nationalTotal = rows.reduce((acc, r: any) => acc + (r.total || 0), 0);
  const nationalPesantren = rows.reduce((acc, r: any) => acc + (r.pesantren || 0), 0);
  const nationalMadrasah = rows.reduce((acc, r: any) => acc + (r.madrasah || 0), 0);
  const nationalUniversitas = rows.reduce((acc, r: any) => acc + (r.universitasIslam || 0), 0);

  return {
    filterApplied: {
      type: input.type || "semua",
      sortBy,
    },
    nationalSummary: {
      totalProvincesListed: rows.length,
      nationalTotalInstitutions: nationalTotal,
      nationalPesantren,
      nationalMadrasah,
      nationalUniversitas,
    },
    provinces: rows,
  };
}
