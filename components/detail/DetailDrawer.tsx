"use client";

import { useEffect, useState } from "react";
import {
  X,
  MapPin,
  ExternalLink,
  Edit3,
  Award,
  Layers,
  FileText,
  BadgeCheck,
  Building,
  Coins,
  Loader2,
} from "lucide-react";
import {
  TYPE_LABELS,
  LEVEL_LABELS,
  STATUS_LABELS,
  formatArea,
  formatCurrency,
} from "@/lib/utils";

interface DetailDrawerProps {
  institutionId: string | null;
  onClose: () => void;
  onOpenSuggestEdit: (institution: any) => void;
}

export default function DetailDrawer({
  institutionId,
  onClose,
  onOpenSuggestEdit,
}: DetailDrawerProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!institutionId) {
      setData(null);
      return;
    }

    setLoading(true);
    fetch(`/api/institutions/${institutionId}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
      })
      .catch((err) => {
        console.error("Failed to load institution detail:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [institutionId]);

  if (!institutionId) return null;

  const typeColor =
    data?.type === "pesantren"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : data?.type === "madrasah"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

  return (
    <div className="fixed inset-y-0 right-0 z-500 w-full sm:w-110 bg-white/95 backdrop-blur-2xl shadow-2xl border-l border-zinc-200 flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {data && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${typeColor}`}
            >
              {TYPE_LABELS[data.type] || data.type}
            </span>
          )}
          {data?.status && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
              {STATUS_LABELS[data.status] || data.status}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <p className="text-xs">Memuat data institusi...</p>
          </div>
        ) : data ? (
          <>
            {/* Title & Location */}
            <div>
              <h2 className="text-lg font-bold text-zinc-900 leading-snug">
                {data.name}
              </h2>
              <div className="flex items-start gap-1.5 mt-2 text-xs text-zinc-500">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-400" />
                <span>
                  {data.address || "Alamat belum tercatat"},{" "}
                  <strong>{data.city || ""}</strong>, {data.province || ""}
                </span>
              </div>
            </div>

            {/* Quick Badges Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                <span className="text-[10px] text-zinc-400 font-medium block mb-0.5">
                  Jenjang
                </span>
                <span className="font-semibold text-zinc-800">
                  {LEVEL_LABELS[data.level] || data.level || "—"}
                </span>
              </div>
              <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                <span className="text-[10px] text-zinc-400 font-medium block mb-0.5">
                  Akreditasi
                </span>
                <span className="font-semibold text-zinc-800 flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {data.accreditation || "Belum Ada"}
                </span>
              </div>
            </div>

            {/* Data Lahan & Legalitas */}
            <div className="border border-zinc-100 bg-zinc-50/50 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Informasi Tanah & Legalitas
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 block">Total Luas Tanah</span>
                  <strong className="text-zinc-800 text-sm">
                    {formatArea(data.land?.total_area_m2)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">Status Sertifikat</span>
                  <span className="font-medium text-zinc-700">
                    {data.land?.certificate_status || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">No. Sertifikat</span>
                  <span className="font-mono text-zinc-600 text-[11px]">
                    {data.land?.certificate_number || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">Status Kepemilikan</span>
                  <span className="font-medium text-zinc-700">
                    {data.land?.ownership && data.land.ownership.length > 0
                      ? data.land.ownership.join(", ")
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Zonasi Penggunaan Lahan */}
              {data.land?.use_categories && data.land.use_categories.length > 0 && (
                <div className="pt-2 border-t border-zinc-200/60">
                  <span className="text-[10px] text-zinc-400 block mb-1.5">
                    Peruntukan / Zonasi Lahan
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.land.use_categories.map((cat: string) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 bg-white border border-zinc-200 rounded-md text-[10px] font-medium text-zinc-700 capitalize"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Valuasi & NJOP */}
              {(data.land?.njop || data.land?.estimated_total_value) && (
                <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Estimasi Nilai Total</span>
                    <strong className="text-emerald-700 font-semibold">
                      {formatCurrency(data.land?.estimated_total_value)}
                    </strong>
                  </div>
                  {data.land?.price_per_m2 && (
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block">Harga / m²</span>
                      <span className="text-zinc-600 font-medium">
                        {formatCurrency(data.land?.price_per_m2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Coordinates info */}
            {data.coordinates && (
              <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 block">Koordinat Geografis</span>
                  <span className="font-mono text-zinc-700 text-[11px]">
                    {data.coordinates[0].toFixed(5)}, {data.coordinates[1].toFixed(5)}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 text-zinc-700 font-medium uppercase">
                  {data.coordinate_precision || "GPS"}
                </span>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Footer Actions */}
      {data && (
        <div className="p-4 border-t border-zinc-100 bg-white flex items-center gap-2">
          <a
            href={`/institutions/${data.id}`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-emerald-600/20"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Lihat Detail Lengkap</span>
          </a>
          <button
            onClick={() => onOpenSuggestEdit(data)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold transition-all"
            title="Usulkan Koreksi Data Lembaga"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Koreksi</span>
          </button>
        </div>
      )}
    </div>
  );
}
