import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  searchInstitutionsHandler,
  searchInstitutionsSchema,
  getInstitutionDetailHandler,
  getInstitutionDetailSchema,
  findInstitutionByNameHandler,
  findInstitutionByNameSchema,
  getInstitutionStatsHandler,
  getInstitutionStatsSchema,
  getAboutInfoHandler,
  getAboutInfoSchema,
  getNearbyInstitutionsHandler,
  getNearbyInstitutionsSchema,
  getInstitutionLandPolygonsHandler,
  getInstitutionLandPolygonsSchema,
  getProvincesSummaryHandler,
  getProvincesSummarySchema,
} from "./tools";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "sis-lpi-next-mcp",
    version: "1.0.0",
  });

  // 1. Tool Pencarian Multi-Filter Umum (Publik)
  server.tool(
    "search_institutions",
    "Mencari dan menyaring data lembaga pendidikan Islam publik berdasarkan kata kunci umum, alamat, kota, provinsi, tipe, atau status verifikasi dengan dukungan pagination.",
    searchInstitutionsSchema.shape,
    async (args) => {
      try {
        const result = await searchInstitutionsHandler(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error?.message || String(error)}` }],
        };
      }
    }
  );

  // 2. Tool Detail Berdasarkan ID (Publik)
  server.tool(
    "get_institution_detail",
    "Mengambil informasi detail lengkap 1 lembaga publik berdasarkan ID spesifik (misal: '01375'), termasuk polygon lahan dan titik fasilitas.",
    getInstitutionDetailSchema.shape,
    async (args) => {
      try {
        const result = await getInstitutionDetailHandler(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error?.message || String(error)}` }],
        };
      }
    }
  );

  // 3. Tool Pencarian Berdasarkan Nama / Luas Lahan (Publik)
  server.tool(
    "find_institution_by_name",
    "Mencari lembaga pendidikan Islam berdasarkan nama lengkap atau alias/akronim (misal: 'UIN Malang', 'Universitas Islam Negeri Maulana Malik Ibrahim', 'Pesantren Tebuireng') dan langsung mengembalikan detail profil, luas lahan (landTotalAreaM2), sertifikat, polygon, dan titik fasilitas.",
    findInstitutionByNameSchema.shape,
    async (args) => {
      try {
        const result = await findInstitutionByNameHandler(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error?.message || String(error)}` }],
        };
      }
    }
  );

  // 4. Tool Statistik Wilayah & Kategori (Publik)
  server.tool(
    "get_institution_stats",
    "Membaca data statistik agregat lembaga pendidikan Islam (misal: 'Berapa pesantren di Kota Malang', total luas lahan, breakdown per jenis lembaga, status negeri/swasta, atau per kota/provinsi).",
    getInstitutionStatsSchema.shape,
    async (args) => {
      try {
        const result = await getInstitutionStatsHandler(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error?.message || String(error)}` }],
        };
      }
    }
  );

  // 5. Tool Informasi Publik & Metodologi SIS-LPI (/about)
  server.tool(
    "get_about_info",
    "Membaca informasi lengkap tentang platform publik SIS-LPI (latar belakang, visi, prinsip syariah amānah/khilāfah/mīzān, 3 pilar lembaga pesantren/madrasah/PTKI, fitur-fitur Web-GIS, dan metodologi presisi koordinat spasial).",
    getAboutInfoSchema.shape,
    async (args) => {
      try {
        const result = await getAboutInfoHandler(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error?.message || String(error)}` }],
        };
      }
    }
  );

  // 6. Tool Spasial Radius Lembaga Terdekat (GIS Proximity Query)
  server.tool(
    "get_nearby_institutions",
    "Mencari lembaga pendidikan Islam publik terdekat berdasarkan titik koordinat (latitude, longitude) dalam radius kilometer tertentu (misal: mencari pesantren dalam radius 5 km dari lokasi tertentu). Menghitung jarak presisi dalam kilometer dan meter.",
    getNearbyInstitutionsSchema.shape,
    async (args) => {
      try {
        const result = await getNearbyInstitutionsHandler(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error?.message || String(error)}` }],
        };
      }
    }
  );

  // 7. Tool Spasial Poligon Lahan & Fasilitas GeoJSON (/institutions/[id])
  server.tool(
    "get_institution_land_polygons",
    "Mengambil data spasial GeoJSON FeatureCollection lengkap dari bidang tanah (polygons) dan titik fasilitas (child points) milik lembaga publik (seperti di halaman /institutions/[id]), mencakup perimeter batas luar, luas m² & hektar, zonasi peruntukan, dan legalitas sertifikat wakaf.",
    getInstitutionLandPolygonsSchema.shape,
    async (args) => {
      try {
        const result = await getInstitutionLandPolygonsHandler(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error?.message || String(error)}` }],
        };
      }
    }
  );

  // 8. Tool Agregasi Sebaran Provinsi Nasional (Publik)
  server.tool(
    "get_provinces_summary",
    "Membaca ringkasan sebaran lembaga pendidikan Islam di seluruh 38 provinsi di Indonesia (jumlah total lembaga, breakdown pesantren, madrasah, PTKI, serta total luas lahan per provinsi).",
    getProvincesSummarySchema.shape,
    async (args) => {
      try {
        const result = await getProvincesSummaryHandler(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error?.message || String(error)}` }],
        };
      }
    }
  );

  return server;
}
