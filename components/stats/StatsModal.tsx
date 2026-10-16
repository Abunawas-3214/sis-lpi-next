"use client";

import { useEffect, useState } from "react";
import { X, BarChart2, Layers, MapPin, Building, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StatsModal({ isOpen, onClose }: StatsModalProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error("Failed to load stats:", err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-600 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Statistik Nasional SIS-LPI
              </h2>
              <p className="text-xs text-zinc-500">
                Data agregat dari 35.000+ lembaga pendidikan Islam terdata
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <p>Menghitung data statistik nasional...</p>
            </div>
          ) : stats ? (
            <>
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-zinc-50 border border-zinc-100 rounded-2xl">
                  <span className="text-[11px] text-zinc-500 block mb-1">
                    Total Lembaga
                  </span>
                  <strong className="text-xl font-bold text-zinc-900">
                    {formatNumber(stats.total)}
                  </strong>
                </div>
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                  <span className="text-[11px] text-emerald-700 block mb-1">
                    Pesantren
                  </span>
                  <strong className="text-xl font-bold text-emerald-800">
                    {formatNumber(stats.by_type?.pesantren || 0)}
                  </strong>
                </div>
                <div className="p-3.5 bg-amber-50/60 border border-amber-100 rounded-2xl">
                  <span className="text-[11px] text-amber-700 block mb-1">
                    Madrasah
                  </span>
                  <strong className="text-xl font-bold text-amber-800">
                    {formatNumber(stats.by_type?.madrasah || 0)}
                  </strong>
                </div>
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
                  <span className="text-[11px] text-indigo-700 block mb-1">
                    Perguruan Tinggi
                  </span>
                  <strong className="text-xl font-bold text-indigo-800">
                    {formatNumber(stats.by_type?.universitas_islam || 0)}
                  </strong>
                </div>
              </div>

              {/* Status Negeri vs Swasta */}
              <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl space-y-2">
                <div className="flex items-center justify-between font-semibold text-zinc-800">
                  <span>Komposisi Status Lembaga</span>
                  <span className="text-zinc-500 text-[11px]">
                    Swasta: {formatNumber(stats.by_status?.swasta || 0)} | Negeri:{" "}
                    {formatNumber(stats.by_status?.negeri || 0)}
                  </span>
                </div>
                {/* Visual bar */}
                <div className="h-3 w-full bg-zinc-200 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${
                        ((stats.by_status?.swasta || 0) / (stats.total || 1)) * 100
                      }%`,
                    }}
                    className="bg-emerald-600 h-full"
                    title="Swasta"
                  />
                  <div
                    style={{
                      width: `${
                        ((stats.by_status?.negeri || 0) / (stats.total || 1)) * 100
                      }%`,
                    }}
                    className="bg-indigo-600 h-full"
                    title="Negeri"
                  />
                </div>
              </div>

              {/* Top 10 Provinsi */}
              <div className="space-y-3">
                <h3 className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  10 Provinsi dengan Konsentrasi Lembaga Terbanyak
                </h3>

                <div className="space-y-2">
                  {Object.entries(stats.by_province_top10 || {}).map(
                    ([prov, val]: [string, any], idx) => {
                      const maxVal = Math.max(
                        ...Object.values(stats.by_province_top10 || {}).map(
                          Number
                        )
                      );
                      const pct = Math.round((val / (maxVal || 1)) * 100);

                      return (
                        <div key={prov} className="space-y-1">
                          <div className="flex justify-between text-zinc-700">
                            <span className="font-medium">
                              {idx + 1}. {prov}
                            </span>
                            <span className="font-semibold text-zinc-900">
                              {formatNumber(val)}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
