"use client";

import { useState } from "react";
import { Plus, Trash2, Layers, Check } from "lucide-react";

export interface ParcelItem {
  name: string;
  category: string;
  area_m2?: number;
  geometry?: [number, number][]; // [[lng, lat], ...]
}

interface ParcelsManagerProps {
  parcels: ParcelItem[];
  onChange: (parcels: ParcelItem[]) => void;
}

const CATEGORIES = [
  { id: "pendidikan", label: "Pendidikan (Gedung/Kelas)" },
  { id: "ibadah", label: "Ibadah (Masjid/Musholla)" },
  { id: "asrama", label: "Asrama / Pondokan" },
  { id: "olahraga", label: "Olahraga" },
  { id: "ekonomi", label: "Ekonomi / Koperasi / Usaha" },
  { id: "pertanian", label: "Pertanian / Perkebunan" },
  { id: "perkantoran", label: "Perkantoran / Administrasi" },
  { id: "lahan_kosong", label: "Lahan Kosong / Pengembangan" },
  { id: "lainnya", label: "Lainnya" },
];

export default function ParcelsManager({
  parcels = [],
  onChange,
}: ParcelsManagerProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("pendidikan");
  const [areaM2, setAreaM2] = useState("");

  const handleAddParcel = () => {
    if (!name.trim()) return;
    const newParcel: ParcelItem = {
      name: name.trim(),
      category,
      area_m2: areaM2 ? parseFloat(areaM2) : undefined,
    };
    onChange([...parcels, newParcel]);
    setName("");
    setAreaM2("");
  };

  const handleRemove = (index: number) => {
    onChange(parcels.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" />
          <span>Sub-Zonasi / Bidang Lahan Lembaga ({parcels.length})</span>
        </h4>
      </div>

      {/* Add Parcel Inline Form */}
      <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama zonasi (cth: Asrama Putri)"
          className="px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-700"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={areaM2}
          onChange={(e) => setAreaM2(e.target.value)}
          placeholder="Luas (m²)"
          className="px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={handleAddParcel}
          className="px-3 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Sub-Zonasi</span>
        </button>
      </div>

      {/* List of Parcels */}
      {parcels.length > 0 ? (
        <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden bg-white text-xs">
          {parcels.map((p, idx) => (
            <div
              key={idx}
              className="p-3 flex items-center justify-between hover:bg-zinc-50 transition-colors"
            >
              <div>
                <span className="font-semibold text-zinc-900">{p.name}</span>
                <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] bg-zinc-100 text-zinc-700 font-medium">
                  {p.category}
                </span>
                {p.area_m2 && (
                  <span className="ml-2 text-zinc-500">
                    {p.area_m2.toLocaleString("id-ID")} m²
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-400 italic">
          Belum ada sub-zonasi yang ditambahkan.
        </p>
      )}
    </div>
  );
}
