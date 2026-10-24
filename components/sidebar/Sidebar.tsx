"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Layers,
  MapPin,
  LogIn,
  PlusCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface SidebarProps {
  search: string;
  onSearchChange: (val: string) => void;
  selectedProvince: string;
  onProvinceChange: (val: string) => void;
  provinces: string[];
  selectedType: string;
  onTypeChange: (val: string) => void;
  selectedStatus: string;
  onStatusChange: (val: string) => void;
  selectedLevel: string;
  onLevelChange: (val: string) => void;
  selectedAccreditation: string;
  onAccreditationChange: (val: string) => void;
  visibleLayers: {
    pesantren: boolean;
    madrasah: boolean;
    universitas_islam: boolean;
    polygons: boolean;
  };
  onToggleLayer: (layer: keyof SidebarProps["visibleLayers"]) => void;
  onOpenSuggestModal: () => void;
  onOpenStatsModal: () => void;
  totalFiltered: number;
}

export default function Sidebar({
  search,
  onSearchChange,
  selectedProvince,
  onProvinceChange,
  provinces,
  selectedType,
  onTypeChange,
  selectedStatus,
  onStatusChange,
  selectedLevel,
  onLevelChange,
  selectedAccreditation,
  onAccreditationChange,
  visibleLayers,
  onToggleLayer,
  onOpenSuggestModal,
  onOpenStatsModal,
  totalFiltered,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openSections, setOpenSections] = useState({
    layers: true,
    filters: true,
  });

  const toggleSection = (section: "layers" | "filters") => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <>
      {/* Floating Reopen Button when Minimized (Desktop & Mobile) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Buka Panel Filter & Pencarian"
          className="fixed md:absolute top-4 left-4 z-400 flex items-center gap-2.5 px-3.5 py-2.5 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-zinc-200/80 hover:bg-zinc-50 text-zinc-800 transition-all text-xs font-semibold hover:shadow-2xl active:scale-95 group"
        >
          <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-[10px] shadow-sm">
            SIS
          </div>
          <div className="flex items-center gap-1.5 text-zinc-700 group-hover:text-zinc-900">
            <PanelLeftOpen className="w-4 h-4 text-emerald-600" />
            <span>Panel Kontrol ({totalFiltered.toLocaleString()})</span>
          </div>
        </button>
      )}

      {/* Main Sidebar Floating Panel */}
      <aside
        className={`fixed md:absolute top-4 left-4 z-400 w-84 md:w-96 max-h-[calc(100vh-2rem)] flex flex-col bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/80 transition-all duration-300 ${
          isOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "-translate-x-[110%] opacity-0 pointer-events-none"
        }`}
      >
        {/* Header Branding */}
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">
              SIS
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-900 tracking-tight leading-tight">
                SIS-LPI
              </h1>
              <p className="text-[11px] text-zinc-500 leading-tight">
                Sistem Informasi Spasial LPI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenStatsModal}
              title="Statistik Nasional"
              className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <a
              href="/login"
              title="Masuk / Login"
              className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <LogIn className="w-4 h-4" />
            </a>
            <button
              onClick={() => setIsOpen(false)}
              title="Sembunyikan / Minimize Panel"
              className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors ml-1"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari nama, kota, uin, man, ponpes..."
              className="w-full pl-9 pr-8 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {search && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action: Usulkan Lembaga Baru */}
          <button
            onClick={onOpenSuggestModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all text-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Usulkan Lembaga Baru</span>
          </button>

          {/* Section: Layer Kategori */}
          <div className="border border-zinc-100 rounded-xl bg-zinc-50/50 overflow-hidden">
            <button
              onClick={() => toggleSection("layers")}
              className="w-full px-3 py-2.5 flex items-center justify-between text-zinc-700 font-semibold hover:bg-zinc-100/60 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                Layer Peta
              </span>
              {openSections.layers ? (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>

            {openSections.layers && (
              <div className="p-3 pt-1 space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                  <input
                    type="checkbox"
                    checked={visibleLayers.pesantren}
                    onChange={() => onToggleLayer("pesantren")}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <span className="text-zinc-700 font-medium">Pondok Pesantren</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                  <input
                    type="checkbox"
                    checked={visibleLayers.madrasah}
                    onChange={() => onToggleLayer("madrasah")}
                    className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-zinc-700 font-medium">Madrasah</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                  <input
                    type="checkbox"
                    checked={visibleLayers.universitas_islam}
                    onChange={() => onToggleLayer("universitas_islam")}
                    className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                  <span className="text-zinc-700 font-medium">Perguruan Tinggi Islam</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                  <input
                    type="checkbox"
                    checked={visibleLayers.polygons}
                    onChange={() => onToggleLayer("polygons")}
                    className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="w-2.5 h-2.5 rounded-sm border-2 border-teal-600 bg-teal-100"></span>
                  <span className="text-zinc-700 font-medium">Hanya Lembaga Berpeta</span>
                </label>
              </div>
            )}
          </div>

          {/* Section: Filter Lanjutan */}
          <div className="border border-zinc-100 rounded-xl bg-zinc-50/50 overflow-hidden">
            <button
              onClick={() => toggleSection("filters")}
              className="w-full px-3 py-2.5 flex items-center justify-between text-zinc-700 font-semibold hover:bg-zinc-100/60 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-zinc-500" />
                Filter Wilayah & Status
              </span>
              {openSections.filters ? (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>

            {openSections.filters && (
              <div className="p-3 pt-1 space-y-3">
                {/* Provinsi */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Provinsi
                  </label>
                  <select
                    value={selectedProvince}
                    onChange={(e) => onProvinceChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Semua Provinsi</option>
                    {provinces.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Operasional */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Status Lembaga
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => onStatusChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Semua Status</option>
                    <option value="negeri">Negeri</option>
                    <option value="swasta">Swasta</option>
                  </select>
                </div>

                {/* Jenjang */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Jenjang Pendidikan
                  </label>
                  <select
                    value={selectedLevel}
                    onChange={(e) => onLevelChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Semua Jenjang</option>
                    <option value="dasar">Dasar (MI)</option>
                    <option value="menengah">Menengah (MTs)</option>
                    <option value="atas">Atas (MA)</option>
                    <option value="tinggi">Tinggi (PTKI)</option>
                  </select>
                </div>

                {/* Akreditasi */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Akreditasi
                  </label>
                  <select
                    value={selectedAccreditation}
                    onChange={(e) => onAccreditationChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Semua Akreditasi</option>
                    <option value="terakreditasi">Terakreditasi (A/B/C)</option>
                    <option value="belum">Belum Terakreditasi</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-zinc-100 bg-zinc-50/50 rounded-b-2xl flex items-center justify-between text-[11px] text-zinc-500">
          <span>
            Hasil terfilter: <strong className="text-zinc-800 font-semibold">{totalFiltered.toLocaleString()}</strong>
          </span>
          {(search || selectedProvince || selectedStatus || selectedLevel || selectedAccreditation) && (
            <button
              onClick={() => {
                onSearchChange("");
                onProvinceChange("");
                onStatusChange("");
                onLevelChange("");
                onAccreditationChange("");
              }}
              className="text-emerald-600 hover:underline font-medium"
            >
              Reset Filter
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
