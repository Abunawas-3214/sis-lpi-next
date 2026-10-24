"use client";

import { useState, useEffect } from "react";
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Building,
  AlertTriangle,
  CheckCircle,
  Tag,
  Layers,
  X,
  Info,
  Crosshair,
} from "lucide-react";
import {
  InstitutionPolygon,
  ChildPointItem,
  CustomVariable,
  isPointInPolygon,
  toLeafletLatLngs,
} from "@/lib/geometry";

interface ChildPointsManagerProps {
  institutionId?: string;
  childPoints: ChildPointItem[];
  polygons: InstitutionPolygon[];
  onChange: (points: ChildPointItem[]) => void;
  onStatusChange?: (status: string) => void;
  isPickingPoint?: boolean;
  onStartPickPoint?: () => void;
  pickedCoords?: { lat: number; lng: number; polygonId?: string; polygonName?: string } | null;
}

const CATEGORIES = [
  { id: "pendidikan", label: "Pendidikan (Gedung Kelas/Fakultas)" },
  { id: "ibadah", label: "Ibadah (Masjid / Musholla)" },
  { id: "perkantoran", label: "Perkantoran / Administrasi / Rektorat" },
  { id: "asrama", label: "Asrama / Pondokan Santri" },
  { id: "olahraga", label: "Fasilitas Olahraga" },
  { id: "laboratorium", label: "Laboratorium / Praktik" },
  { id: "umum", label: "Fasilitas Umum / Lainnya" },
];

export default function ChildPointsManager({
  institutionId,
  childPoints = [],
  polygons = [],
  onChange,
  onStatusChange,
  isPickingPoint = false,
  onStartPickPoint,
  pickedCoords,
}: ChildPointsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPoint, setEditingPoint] = useState<ChildPointItem | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("pendidikan");
  const [selectedPolyId, setSelectedPolyId] = useState(
    polygons[0]?.id || ""
  );
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [notes, setNotes] = useState("");
  const [customVars, setCustomVars] = useState<CustomVariable[]>([]);
  const [varKey, setVarKey] = useState("");
  const [varVal, setVarVal] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync picked coordinates from map click
  useEffect(() => {
    if (pickedCoords && (showAddForm || editingPoint)) {
      setLatInput(pickedCoords.lat.toFixed(6));
      setLngInput(pickedCoords.lng.toFixed(6));
      if (pickedCoords.polygonId) {
        setSelectedPolyId(pickedCoords.polygonId);
      }
      setErrorMsg("");
    }
  }, [pickedCoords]);

  // Filter polygons that have at least 3 points
  const validPolygons = polygons.filter(
    (p) => p.coordinates && p.coordinates.length >= 3
  );

  const activePolygon = validPolygons.find((p) => p.id === selectedPolyId) || validPolygons[0];

  const handleSetCenterOfPolygon = () => {
    if (!activePolygon) return;
    const latLngs = toLeafletLatLngs(activePolygon.coordinates);
    if (latLngs.length === 0) return;
    const avgLat = latLngs.reduce((acc, p) => acc + p[0], 0) / latLngs.length;
    const avgLng = latLngs.reduce((acc, p) => acc + p[1], 0) / latLngs.length;
    setLatInput(avgLat.toFixed(6));
    setLngInput(avgLng.toFixed(6));
    setErrorMsg("");
  };

  const handleAddCustomVar = () => {
    if (!varKey.trim() || !varVal.trim()) return;
    const newVar: CustomVariable = {
      key: varKey.trim().toLowerCase().replace(/\s+/g, "_"),
      label: varKey.trim(),
      value: varVal.trim(),
    };
    setCustomVars((prev) => [...prev, newVar]);
    setVarKey("");
    setVarVal("");
  };

  const handleRemoveCustomVar = (idx: number) => {
    setCustomVars((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStartEdit = (point: ChildPointItem) => {
    setEditingPoint(point);
    setName(point.name || "");
    setCategory(point.category?.toLowerCase() || "pendidikan");
    setSelectedPolyId(point.polygonId || validPolygons[0]?.id || "");
    setLatInput(point.latitude ? String(point.latitude) : "");
    setLngInput(point.longitude ? String(point.longitude) : "");
    setNotes(point.notes || "");

    // Parse existing custom variables
    const rawVars = point.customVariables || (point as any).custom_variables;
    if (Array.isArray(rawVars)) {
      setCustomVars(rawVars);
    } else if (rawVars && typeof rawVars === "object") {
      setCustomVars(
        Object.entries(rawVars).map(([k, v]) => ({
          key: k,
          label: k.replace(/_/g, " "),
          value: String(v),
        }))
      );
    } else {
      setCustomVars([]);
    }

    setErrorMsg("");
    setShowAddForm(true);
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingPoint(null);
    setName("");
    setLatInput("");
    setLngInput("");
    setNotes("");
    setCustomVars([]);
    setErrorMsg("");
  };

  const handleSavePoint = async () => {
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Nama fasilitas gedung wajib diisi.");
      return;
    }

    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);

    if (isNaN(lat) || isNaN(lng)) {
      setErrorMsg("Koordinat latitude dan longitude harus berupa angka valid.");
      return;
    }

    if (!activePolygon) {
      setErrorMsg("Pilih polygon bidang lahan tempat titik ini berada.");
      return;
    }

    // Strict validation: Point must be inside the polygon!
    const polyLatLngs = toLeafletLatLngs(activePolygon.coordinates);
    const inside = isPointInPolygon([lat, lng], polyLatLngs);

    if (!inside) {
      setErrorMsg(
        `Koordinat (${lat}, ${lng}) berada di LUAR batas polygon "${activePolygon.name}". Sesuai aturan, titik fasilitas harus berada tepat di dalam bidang polygon.`
      );
      return;
    }

    // Convert customVars to object format
    const customVarsObj: Record<string, string> = {};
    customVars.forEach((v) => {
      customVarsObj[v.key] = v.value;
    });

    setIsSubmitting(true);

    try {
      if (editingPoint) {
        // EDIT MODE (PATCH)
        const pointId = editingPoint.id;
        if (institutionId && pointId && !String(pointId).startsWith("temp-")) {
          const res = await fetch(
            `/api/institutions/${institutionId}/child-points/${pointId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: name.trim(),
                category,
                latitude: lat,
                longitude: lng,
                polygon_id: activePolygon.id,
                polygon_name: activePolygon.name,
                custom_variables: customVarsObj,
                notes: notes.trim(),
              }),
            }
          );

          const json = await res.json();
          if (!res.ok) {
            throw new Error(json.error || "Gagal memperbarui titik fasilitas");
          }
        }

        const updatedPoints = childPoints.map((cp) => {
          if (cp.id === editingPoint.id) {
            return {
              ...cp,
              name: name.trim(),
              category,
              polygonId: activePolygon.id,
              polygonName: activePolygon.name,
              latitude: lat,
              longitude: lng,
              customVariables: customVarsObj,
              notes: notes.trim(),
            };
          }
          return cp;
        });

        onChange(updatedPoints);
      } else {
        // ADD NEW POINT MODE (POST)
        const newPointData: ChildPointItem = {
          id: "temp-" + Date.now(),
          institutionId,
          polygonId: activePolygon.id,
          polygonName: activePolygon.name,
          name: name.trim(),
          category,
          latitude: lat,
          longitude: lng,
          customVariables: customVarsObj,
          notes: notes.trim(),
        };

        if (institutionId) {
          const res = await fetch(`/api/institutions/${institutionId}/child-points`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: newPointData.name,
              category: newPointData.category,
              latitude: newPointData.latitude,
              longitude: newPointData.longitude,
              polygon_id: newPointData.polygonId,
              polygon_name: newPointData.polygonName,
              custom_variables: newPointData.customVariables,
              notes: newPointData.notes,
            }),
          });

          const json = await res.json();
          if (!res.ok) {
            throw new Error(json.error || "Gagal menyimpan titik fasilitas");
          }

          if (json.data) {
            newPointData.id = json.data.id;
          }
        }

        onChange([...childPoints, newPointData]);
      }

      // Notify parent that data has been edited and needs admin validation
      if (onStatusChange) {
        onStatusChange("pengajuan");
      }

      handleCancelForm();
    } catch (err: any) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePoint = async (point: ChildPointItem, index: number) => {
    if (!confirm(`Hapus titik fasilitas "${point.name}"?`)) return;

    if (institutionId && point.id && !String(point.id).startsWith("temp-")) {
      try {
        await fetch(
          `/api/institutions/${institutionId}/child-points/${point.id}`,
          { method: "DELETE" }
        );
      } catch (err) {
        console.error("Failed to delete child point from API:", err);
      }
    }

    if (onStatusChange) {
      onStatusChange("pengajuan");
    }

    onChange(childPoints.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-zinc-200/80 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
        <div>
          <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-600" />
            <span>Titik Fasilitas &amp; Gedung dalam Polygon (Child Points)</span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Setiap titik mewakili gedung / fasilitas spesifik (misal Gedung Rektorat, Masjid, Asrama) dengan variabel kustom.
          </p>
        </div>

        {validPolygons.length > 0 && !showAddForm && (
          <button
            type="button"
            onClick={() => {
              setEditingPoint(null);
              setName("");
              setLatInput("");
              setLngInput("");
              setNotes("");
              setCustomVars([]);
              setErrorMsg("");
              if (validPolygons[0]) {
                setSelectedPolyId(validPolygons[0].id);
              }
              setShowAddForm(true);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Titik Fasilitas</span>
          </button>
        )}
      </div>

      {/* Polygon Prerequisite Warning */}
      {validPolygons.length === 0 ? (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-bold text-amber-950 block">
              Lembaga Belum Memiliki Polygon Lahan
            </strong>
            <p>
              Sesuai persyaratan, titik fasilitas (child points) <b>hanya dapat ditambahkan jika institusi sudah memiliki polygon</b>.
              Silakan buat minimal 1 bidang polygon pada peta di atas terlebih dahulu.
            </p>
          </div>
        </div>
      ) : null}

      {/* Add / Edit Point Form (Notice: using div instead of form to avoid nested form hydration error) */}
      {showAddForm && validPolygons.length > 0 && (
        <div className="p-5 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
              {editingPoint ? (
                <>
                  <Edit2 className="w-4 h-4 text-purple-600" />
                  <span>Edit Titik Fasilitas: {editingPoint.name}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-purple-600" />
                  <span>Tambah Titik Fasilitas Baru</span>
                </>
              )}
            </h4>
            <button
              type="button"
              onClick={handleCancelForm}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Name */}
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Nama Gedung / Fasilitas *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Gedung Rektorat, Masjid Ulul Albab, Asrama Putra"
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Kategori Fasilitas *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Polygon Assignment */}
            <div className="sm:col-span-2">
              <label className="block text-zinc-700 font-semibold mb-1">
                Bidang Polygon Lahan Tempat Berada *
              </label>
              <select
                value={selectedPolyId}
                onChange={(e) => setSelectedPolyId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {validPolygons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.area_m2 ? `(${p.area_m2.toLocaleString()} m²)` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Latitude */}
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Latitude (Garis Lintang) *
              </label>
              <input
                type="text"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                placeholder="Contoh: -7.952512"
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Longitude */}
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Longitude (Garis Bujur) *
              </label>
              <input
                type="text"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                placeholder="Contoh: 112.607421"
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSetCenterOfPolygon}
                className="text-purple-700 hover:text-purple-900 font-medium underline flex items-center gap-1"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Titik Tengah Polygon</span>
              </button>

              {onStartPickPoint && (
                <button
                  type="button"
                  onClick={onStartPickPoint}
                  className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition-all ${
                    isPickingPoint
                      ? "bg-purple-600 text-white border-purple-600 shadow-xs animate-pulse"
                      : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>{isPickingPoint ? "Menunggu Klik di Peta..." : "Klik Titik di Peta (Polygon)"}</span>
                </button>
              )}
            </div>

            <span className="text-zinc-400 text-[11px]">
              Koordinat wajib berada tepat di dalam bidang polygon
            </span>
          </div>

          {/* Custom Variables Section */}
          <div className="pt-3 border-t border-purple-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-600" />
                <span>Variabel Kustom / Atribut Dinamis</span>
              </span>
              <span className="text-[11px] text-zinc-500">
                (Contoh: Luas Lantai, Daya Tampung, Tahun Dibangun)
              </span>
            </div>

            {/* Existing custom variables list */}
            {customVars.length > 0 && (
              <div className="flex flex-wrap gap-1.5 py-1">
                {customVars.map((v, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 bg-white border border-purple-200 text-purple-950 px-2.5 py-1 rounded-xl text-xs"
                  >
                    <b>{v.label}:</b> {v.value}
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomVar(idx)}
                      className="text-zinc-400 hover:text-red-600 transition-colors ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Input to add variable */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={varKey}
                onChange={(e) => setVarKey(e.target.value)}
                placeholder="Nama Variabel (e.g. Luas Lantai)"
                className="flex-1 px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none"
              />
              <input
                type="text"
                value={varVal}
                onChange={(e) => setVarVal(e.target.value)}
                placeholder="Nilai (e.g. 3.200 m² atau 5 Lantai)"
                className="flex-1 px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomVar}
                className="px-3 py-1.5 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors"
              >
                + Tambah
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-zinc-700 font-semibold mb-1 text-xs">
              Keterangan / Catatan Tambahan (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Diresmikan tahun 2018, dilengkapi lift dan AC sentral"
              className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancelForm}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSavePoint}
              disabled={isSubmitting}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? "Menyimpan..."
                  : editingPoint
                  ? "Simpan Perubahan Titik"
                  : "Simpan Titik ke Polygon"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* List of existing child points */}
      {childPoints.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {childPoints.map((cp, idx) => {
            const rawVars = cp.customVariables || (cp as any).custom_variables;
            const varEntries =
              rawVars && typeof rawVars === "object"
                ? Array.isArray(rawVars)
                  ? rawVars
                  : Object.entries(rawVars).map(([k, v]) => ({ key: k, value: String(v) }))
                : [];

            return (
              <div
                key={cp.id || idx}
                className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-2xl space-y-2 hover:border-purple-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                      {cp.category || "Fasilitas"}
                    </span>
                    <h4 className="font-bold text-zinc-900 text-sm mt-1">
                      {cp.name}
                    </h4>
                    {cp.polygonName && (
                      <span className="text-[11px] text-zinc-500 block">
                        Bidang: <i>{cp.polygonName}</i>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(cp)}
                      className="p-1.5 text-zinc-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Edit Titik Fasilitas"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePoint(cp, idx)}
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Hapus Titik"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-zinc-600">
                  📍 {cp.latitude?.toFixed(6)}, {cp.longitude?.toFixed(6)}
                </div>

                {varEntries.length > 0 && (
                  <div className="pt-2 border-t border-zinc-200/60 space-y-1">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                      Variabel Kustom:
                    </span>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
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
        <div className="p-8 text-center text-zinc-400 text-xs bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
          Belum ada titik fasilitas yang ditambahkan ke dalam polygon lembaga ini.
        </div>
      )}
    </div>
  );
}
