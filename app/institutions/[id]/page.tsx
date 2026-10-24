"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  MapPin,
  Edit3,
  Award,
  Layers,
  FileText,
  BadgeCheck,
  Building,
  Coins,
  Loader2,
  Calendar,
  Share2,
  CheckCircle2,
} from "lucide-react";
import {
  TYPE_LABELS,
  LEVEL_LABELS,
  STATUS_LABELS,
  formatArea,
  formatCurrency,
} from "@/lib/utils";
import SuggestEditModal from "@/components/modals/SuggestEditModal";

// Dynamic Mini Map
const MiniMap = dynamic(() => import("@/components/map/MiniMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs">
      <Loader2 className="w-5 h-5 animate-spin mr-2 text-emerald-600" />
      <span>Memuat peta...</span>
    </div>
  ),
});

function InstitutionDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/institutions/${id}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Error loading institution:", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm">Memuat rincian lembaga...</p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-4">
        <p className="text-base font-semibold text-zinc-800">
          Lembaga tidak ditemukan
        </p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold"
        >
          Kembali ke Peta
        </button>
      </div>
    );
  }

  const typeColor =
    data.type === "pesantren"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : data.type === "madrasah"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 font-sans pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-400 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 px-6 py-3.5 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Peta GIS</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSuggestOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Usulkan Koreksi Data</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 pt-8 space-y-8">
        {/* Header Hero Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-zinc-200/80 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${typeColor}`}
            >
              {TYPE_LABELS[data.type] || data.type}
            </span>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-zinc-100 text-zinc-700">
              {STATUS_LABELS[data.status] || data.status}
            </span>
            {data.verification_status && (
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1 ${
                  data.verification_status === "valid"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : data.verification_status === "pengajuan"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {data.verification_status === "valid"
                  ? "Data Valid"
                  : data.verification_status === "pengajuan"
                  ? "Menunggu Verifikasi"
                  : "Tidak Valid"}
              </span>
            )}
            {data.land?.polygons && data.land.polygons.length > 0 ? (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                {data.land.polygons.length} Bidang Polygon
              </span>
            ) : (
              <span className="text-xs font-normal px-3 py-1 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-zinc-400" />
                Belum Ada Polygon
              </span>
            )}
            {data.child_points && data.child_points.length > 0 && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {data.child_points.length} Titik Fasilitas
              </span>
            )}
            {data.accreditation && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                <BadgeCheck className="w-3.5 h-3.5" />
                {data.accreditation}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight leading-tight">
            {data.name}
          </h1>

          <div className="flex items-center gap-2 text-xs text-zinc-500 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-zinc-400" />
              {data.address || "Alamat belum tercatat"},{" "}
              <strong>{data.city || ""}</strong>, {data.province || ""}
            </span>
            {data.nomor_data_lembaga && (
              <>
                <span>•</span>
                <span>
                  No. Data Lembaga (NDL/NPSN): <strong>{data.nomor_data_lembaga}</strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Location & Mini Map */}
        {data.coordinates && (
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-200/80 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Lokasi Geografis &amp; Peta Wilayah
              </h2>
            </div>

            {/* Map full-width */}
            <MiniMap
              coordinates={data.coordinates}
              name={data.name}
              type={data.type}
              landGeometry={data.land?.geometry}
              landParcels={data.land?.parcels}
              polygons={data.land?.polygons}
              childPoints={data.child_points || []}
            />

            <div className="px-6 py-4 flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-100">
              <span>
                Koordinat WGS84:{" "}
                <strong className="font-mono text-zinc-800">
                  {data.coordinates[0].toFixed(6)}, {data.coordinates[1].toFixed(6)}
                </strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[10px] uppercase font-bold">
                Presisi: {data.coordinate_precision || "Exact"}
              </span>
            </div>
          </div>
        )}

        {/* Land Attributes & Legal Assets */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-zinc-200/80 space-y-6">
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            Informasi Lahan, Legalitas & Aset Wakaf
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl">
              <span className="text-[11px] text-zinc-400 block mb-1">
                Total Luas Tanah
              </span>
              <strong className="text-lg font-bold text-zinc-900">
                {formatArea(data.land?.total_area_m2)}
              </strong>
            </div>

            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl">
              <span className="text-[11px] text-zinc-400 block mb-1">
                Status Sertifikat
              </span>
              <strong className="text-sm font-semibold text-zinc-800">
                {data.land?.certificate_status || "—"}
              </strong>
              {data.land?.certificate_number && (
                <span className="block text-[11px] text-zinc-500 font-mono mt-0.5">
                  No: {data.land.certificate_number}
                </span>
              )}
            </div>

            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl">
              <span className="text-[11px] text-zinc-400 block mb-1">
                Status Kepemilikan
              </span>
              <strong className="text-sm font-semibold text-zinc-800">
                {data.land?.ownership && data.land.ownership.length > 0
                  ? data.land.ownership.join(", ")
                  : "—"}
              </strong>
            </div>
          </div>

          {/* Valuasi Aset */}
          <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-600" />
              Estimasi Valuasi Nilai Tanah
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[10px] text-emerald-700/80 block">
                  Nilai Jual Objek Pajak (NJOP)
                </span>
                <span className="font-semibold text-emerald-950 text-sm">
                  {formatCurrency(data.land?.njop)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-700/80 block">
                  Estimasi Harga / m²
                </span>
                <span className="font-semibold text-emerald-950 text-sm">
                  {formatCurrency(data.land?.price_per_m2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-700/80 block">
                  Estimasi Total Nilai
                </span>
                <strong className="font-bold text-emerald-800 text-base">
                  {formatCurrency(data.land?.estimated_total_value)}
                </strong>
              </div>
            </div>
          </div>

          {/* Zonasi / Penggunaan Lahan */}
          {data.land?.use_categories && data.land.use_categories.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-zinc-700 block">
                Zonasi & Peruntukan Lahan
              </span>
              <div className="flex flex-wrap gap-2">
                {data.land.use_categories.map((cat: string) => (
                  <span
                    key={cat}
                    className="px-3 py-1 bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 capitalize"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Spatial Polygons & Child Facility Points Section */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-zinc-200/80 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-purple-600" />
              Bidang Polygon &amp; Titik Fasilitas Kampus / Lembaga
            </h2>
            <span className="text-xs text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">
              Khusus Halaman Detail
            </span>
          </div>

          {/* List of Polygons */}
          {data.land?.polygons && data.land.polygons.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Daftar Bidang Polygon Lahan ({data.land.polygons.length} Bidang)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.land.polygons.map((poly: any, idx: number) => (
                  <div
                    key={poly.id || idx}
                    className="p-3.5 bg-blue-50/40 border border-blue-100 rounded-2xl flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-xs text-zinc-900 block">
                        {poly.name || `Bidang ${idx + 1}`}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {poly.coordinates?.length || 0} titik koordinat
                      </span>
                    </div>
                    {poly.area_m2 ? (
                      <div className="text-right">
                        <span className="text-xs font-bold text-blue-900 block">
                          {poly.area_m2.toLocaleString("id-ID")} m²
                        </span>
                        <span className="text-[10px] text-blue-700">
                          {(poly.area_m2 / 10000).toFixed(2)} Ha
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* List of Child Points */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-purple-600" />
              Titik Fasilitas &amp; Gedung di Dalam Polygon ({data.child_points?.length || 0} Titik)
            </h3>

            {data.child_points && data.child_points.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {data.child_points.map((cp: any) => {
                  const rawVars = cp.custom_variables || cp.customVariables;
                  const varEntries =
                    rawVars && typeof rawVars === "object"
                      ? Array.isArray(rawVars)
                        ? rawVars
                        : Object.entries(rawVars).map(([k, v]) => ({ key: k, value: String(v) }))
                      : [];

                  return (
                    <div
                      key={cp.id}
                      className="p-4 bg-zinc-50/80 border border-zinc-200/80 rounded-2xl space-y-2 hover:border-purple-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                            {cp.category || "Fasilitas"}
                          </span>
                          <h4 className="font-bold text-zinc-900 text-sm mt-1.5">
                            {cp.name}
                          </h4>
                          {cp.polygon_name && (
                            <span className="text-[11px] text-zinc-500 block">
                              Lokasi: <i>{cp.polygon_name}</i>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] font-mono text-zinc-600">
                        📍 {cp.latitude?.toFixed(6)}, {cp.longitude?.toFixed(6)}
                      </div>

                      {varEntries.length > 0 && (
                        <div className="pt-2 border-t border-zinc-200/60 space-y-1">
                          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                            Atribut Kustom:
                          </span>
                          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                            {varEntries.map((v: any, vIdx: number) => {
                              const label = v.label || v.key?.replace(/_/g, " ");
                              return (
                                <div key={vIdx} className="bg-white px-2 py-1 rounded-lg border border-zinc-100">
                                  <span className="text-zinc-400 capitalize block text-[10px]">{label}</span>
                                  <span className="font-semibold text-zinc-800">{v.value}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {cp.notes && (
                        <p className="text-[11px] text-zinc-500 italic pt-1">
                          {cp.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 text-center text-zinc-400 text-xs">
                Belum ada titik fasilitas (child points) yang tercatat di dalam polygon lembaga ini.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Suggest Edit Modal */}
      <SuggestEditModal
        isOpen={isSuggestOpen}
        onClose={() => setIsSuggestOpen(false)}
        targetInstitution={data}
        provinces={[data.province || "Jawa Timur"]}
      />
    </div>
  );
}

export default function InstitutionDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <InstitutionDetailContent />
    </Suspense>
  );
}
