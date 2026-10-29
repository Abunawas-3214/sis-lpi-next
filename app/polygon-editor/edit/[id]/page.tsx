"use client";

import { use, Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Save,
  Loader2,
  Layers,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Tag,
  Crosshair,
  Building,
  X,
  RotateCcw,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  Edit3,
  MapPin,
  Plus,
} from "lucide-react";
import {
  normalizePolygons,
  InstitutionPolygon,
  ChildPointItem,
  calculateAreaM2,
  toLeafletLatLngs,
  CHILD_CATEGORY_COLORS,
} from "@/lib/geometry";

const SinglePolygonEditor = dynamic(
  () => import("@/components/map/SinglePolygonEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span>Memuat editor polygon...</span>
      </div>
    ),
  }
);

const CATEGORY_OPTIONS = [
  { id: "pendidikan", label: "Pendidikan (Gedung Kelas/Fakultas)" },
  { id: "ibadah", label: "Ibadah (Masjid / Musholla)" },
  { id: "perkantoran", label: "Perkantoran / Administrasi / Rektorat" },
  { id: "asrama", label: "Asrama / Kobong Santri" },
  { id: "olahraga", label: "Fasilitas Olahraga" },
  { id: "laboratorium", label: "Laboratorium / Praktik" },
  { id: "gedung", label: "Gedung Umum / Serbaguna" },
  { id: "umum", label: "Fasilitas Lainnya" },
];

const PRESET_VARIABLES = [
  { key: "luas_lantai_m2", label: "Luas Lantai (m²)", placeholder: "Contoh: 3200" },
  { key: "jumlah_lantai", label: "Jumlah Lantai", placeholder: "Contoh: 5" },
  { key: "tahun_pembangunan", label: "Tahun Pembangunan", placeholder: "Contoh: 2008" },
  { key: "kapasitas_jamaah", label: "Kapasitas Jamaah", placeholder: "Contoh: 2500" },
  { key: "luas_bangunan_m2", label: "Luas Bangunan (m²)", placeholder: "Contoh: 1800" },
  { key: "koleksi_buku", label: "Koleksi Buku", placeholder: "Contoh: 120000" },
  { key: "penanggung_jawab", label: "Penanggung Jawab", placeholder: "Contoh: Biro Sarpras" },
];

// ── Unsaved Changes Dialog Modal ───────────────────────────────────────────────
function UnsavedChangesDialog({
  onSave,
  onDiscard,
  onCancel,
  saving,
}: {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shrink-0 mt-0.5">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900">Perubahan Belum Disimpan</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Anda telah melakukan perubahan pada bidang polygon ini. Apakah Anda ingin menyimpan perubahan tersebut sebelum kembali ke halaman formulir lembaga?
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Simpan Perubahan & Kembali</span>
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-red-50 text-zinc-700 hover:text-red-700 border border-zinc-200 hover:border-red-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Buang Perubahan & Kembali</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="w-full py-2 text-zinc-500 hover:text-zinc-800 text-xs font-medium transition-colors"
          >
            Batal (Tetap di Editor)
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPolygonContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id: targetPolyId } = use(paramsPromise);
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [inst, setInst] = useState<any>(null);
  const [centerCoords, setCenterCoords] = useState<[number, number] | null>(null);
  const [allPolygons, setAllPolygons] = useState<InstitutionPolygon[]>([]);

  // The polygon being edited
  const [originalPolygon, setOriginalPolygon] = useState<InstitutionPolygon | null>(null);
  const [currentPolygon, setCurrentPolygon] = useState<InstitutionPolygon | null>(null);
  const [childPoints, setChildPoints] = useState<ChildPointItem[]>([]);

  // Dirty tracking & Unsaved Dialog
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Drawer Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // ── Child Point Management State ───────────────────────────────────────────
  const [isPickingChildPoint, setIsPickingChildPoint] = useState(false);
  const [editingChildPoint, setEditingChildPoint] = useState<ChildPointItem | null>(null);
  const [pointCoords, setPointCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pointName, setPointName] = useState("");
  const [pointCategory, setPointCategory] = useState("pendidikan");
  const [pointNotes, setPointNotes] = useState("");
  const [customVarsList, setCustomVarsList] = useState<{ key: string; label: string; value: string }[]>([]);
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarVal, setNewVarVal] = useState("");
  const [savingPoint, setSavingPoint] = useState(false);

  const backUrl = explicitId ? `/institusi/edit?id=${explicitId}` : "/institusi/edit";

  useEffect(() => {
    setLoading(true);
    const url = explicitId ? `/api/institusi/me?id=${explicitId}` : "/api/institusi/me";

    fetch(url)
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then(async (data) => {
        if (!data || data.error) {
          setErrorMsg(data?.error || "Gagal memuat data institusi");
          return;
        }

        const item = data.institution;
        setInst(item);

        if (item.latitude && item.longitude) {
          setCenterCoords([item.latitude, item.longitude]);
        }

        const normalized = normalizePolygons(item.landGeometry, item.name || "Kampus Utama");
        setAllPolygons(normalized);

        const found =
          normalized.find((p) => p.id === targetPolyId) ||
          normalized.find((p) => decodeURIComponent(targetPolyId) === p.id) ||
          (normalized.length > 0 ? normalized[0] : null);

        if (!found) {
          setErrorMsg(`Bidang polygon dengan ID '${targetPolyId}' tidak ditemukan.`);
          setLoading(false);
          return;
        }

        const initialCopy: InstitutionPolygon = JSON.parse(JSON.stringify(found));
        setOriginalPolygon(initialCopy);
        setCurrentPolygon(initialCopy);
        setIsDirty(false);

        // Load child points
        try {
          const cpRes = await fetch(`/api/institutions/${item.id}/child-points`);
          const cpData = await cpRes.json();
          if (cpData.data) {
            const formatted: ChildPointItem[] = cpData.data
              .filter(
                (cp: any) =>
                  cp.polygon_id === found.id ||
                  cp.polygon_name === found.name ||
                  cp.polygonId === found.id
              )
              .map((cp: any) => ({
                id: cp.id,
                institutionId: cp.institution_id,
                polygonId: cp.polygon_id,
                polygonName: cp.polygon_name,
                name: cp.name,
                category: cp.category,
                latitude: cp.latitude,
                longitude: cp.longitude,
                customVariables: cp.custom_variables,
                notes: cp.notes,
              }));
            setChildPoints(formatted);
          }
        } catch (e) {
          console.error("Error loading child points:", e);
        }
      })
      .catch((err) => {
        console.error(err);
        setErrorMsg("Terjadi kesalahan memuat data.");
      })
      .finally(() => setLoading(false));
  }, [explicitId, targetPolyId, router]);

  // Warn on tab close or refresh if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Track polygon changes
  const handlePolygonChange = useCallback((updated: InstitutionPolygon) => {
    setCurrentPolygon(updated);
    setIsDirty(true);
  }, []);

  // Reset polygon to initial state
  const handleReset = () => {
    if (!originalPolygon) return;
    if (confirm("Batalkan semua perubahan dan kembalikan bidang polygon ke bentuk awal?")) {
      const resetCopy: InstitutionPolygon = JSON.parse(JSON.stringify(originalPolygon));
      setCurrentPolygon(resetCopy);
      setIsDirty(false);
      setErrorMsg("");
      setSuccessMsg("Perubahan dibatalkan. Bidang polygon dikembalikan ke bentuk awal.");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  // Back button click with unsaved check
  const handleBack = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      router.push(backUrl);
    }
  };

  // Save polygon changes
  const handleSave = async (andNavigate = true) => {
    if (!currentPolygon) return;

    if (!currentPolygon.name.trim()) {
      setErrorMsg("Nama bidang tanah wajib diisi.");
      setShowUnsavedDialog(false);
      return;
    }

    if (!currentPolygon.coordinates || currentPolygon.coordinates.length < 3) {
      setErrorMsg("Bidang tanah harus memiliki minimal 3 titik vertex keliling.");
      setShowUnsavedDialog(false);
      return;
    }

    setSaving(true);
    setErrorMsg("");

    const calculatedArea =
      currentPolygon.area_m2 || calculateAreaM2(toLeafletLatLngs(currentPolygon.coordinates));

    const finalPoly: InstitutionPolygon = {
      ...currentPolygon,
      name: currentPolygon.name.trim(),
      area_m2: calculatedArea,
    };

    const updatedPolygonsList = allPolygons.map((p) =>
      p.id === currentPolygon.id ? finalPoly : p
    );
    const totalAreaM2 = updatedPolygonsList.reduce((acc, p) => acc + (p.area_m2 || 0), 0);

    const payload = {
      landTotalAreaM2: totalAreaM2,
      landGeometry: updatedPolygonsList,
    };

    try {
      const url = explicitId ? `/api/institusi/me?id=${explicitId}` : "/api/institusi/me";
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal menyimpan perubahan polygon.");
      }

      setIsDirty(false);
      setOriginalPolygon(JSON.parse(JSON.stringify(finalPoly)));
      setShowUnsavedDialog(false);

      if (andNavigate) {
        setSuccessMsg("Perubahan polygon berhasil disimpan! Mengalihkan ke formulir lembaga...");
        setTimeout(() => {
          router.push(backUrl);
        }, 700);
      } else {
        setSuccessMsg("Perubahan polygon berhasil disimpan!");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete this polygon
  const handleDeletePolygon = async () => {
    if (!currentPolygon || !inst) return;
    if (
      !confirm(
        `Yakin ingin menghapus bidang '${currentPolygon.name}'? Bidang ini dan data fasilitas di dalamnya akan dihapus.`
      )
    ) {
      return;
    }

    setDeleting(true);
    setErrorMsg("");

    const remainingPolygons = allPolygons.filter((p) => p.id !== currentPolygon.id);
    const totalAreaM2 = remainingPolygons.reduce((acc, p) => acc + (p.area_m2 || 0), 0);

    const payload = {
      landTotalAreaM2: totalAreaM2,
      landGeometry: remainingPolygons.length > 0 ? remainingPolygons : null,
    };

    try {
      const url = explicitId ? `/api/institusi/me?id=${explicitId}` : "/api/institusi/me";
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal menghapus bidang polygon.");
      }

      setIsDirty(false);
      setSuccessMsg("Bidang polygon berhasil dihapus! Mengalihkan ke formulir lembaga...");
      setTimeout(() => {
        router.push(backUrl);
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message);
      setDeleting(false);
    }
  };

  // ── Child Point Handlers ───────────────────────────────────────────────────

  // Start adding a new child point
  const handleStartAddPoint = () => {
    setEditingChildPoint(null);
    setPointName("");
    setPointCategory("pendidikan");
    setPointNotes("");
    setCustomVarsList([]);
    setPointCoords(null);
    setIsPickingChildPoint(true);
    setIsSidebarOpen(true);
  };

  // Start editing existing child point
  const handleStartEditPoint = (cp: ChildPointItem) => {
    setEditingChildPoint(cp);
    setPointName(cp.name);
    setPointCategory(cp.category?.toLowerCase() || "pendidikan");
    setPointNotes(cp.notes || "");
    setPointCoords({ lat: cp.latitude, lng: cp.longitude });
    setIsPickingChildPoint(false);
    setIsSidebarOpen(true);

    // Parse custom variables
    const rawVars = cp.customVariables || (cp as any).custom_variables;
    if (Array.isArray(rawVars)) {
      setCustomVarsList(rawVars.map((v: any) => ({ key: v.key || "", label: v.label || v.key || "", value: String(v.value ?? "") })));
    } else if (rawVars && typeof rawVars === "object") {
      setCustomVarsList(
        Object.entries(rawVars).map(([k, val]) => ({
          key: k,
          label: k.replace(/_/g, " "),
          value: String(val ?? ""),
        }))
      );
    } else {
      setCustomVarsList([]);
    }
  };

  const handleCancelPointForm = () => {
    setEditingChildPoint(null);
    setPointCoords(null);
    setIsPickingChildPoint(false);
    setCustomVarsList([]);
  };

  // Add custom variable
  const handleAddCustomVar = (key: string, label: string, defaultVal = "") => {
    if (customVarsList.some((v) => v.key === key)) return;
    setCustomVarsList((prev) => [...prev, { key, label, value: defaultVal }]);
  };

  const handleAddCustomVarManual = () => {
    if (!newVarKey.trim()) return;
    const formattedKey = newVarKey.trim().toLowerCase().replace(/\s+/g, "_");
    handleAddCustomVar(formattedKey, newVarKey.trim(), newVarVal.trim());
    setNewVarKey("");
    setNewVarVal("");
  };

  const handleRemoveCustomVar = (idx: number) => {
    setCustomVarsList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCustomVarValueChange = (idx: number, val: string) => {
    setCustomVarsList((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], value: val };
      return copy;
    });
  };

  // Save (Create or Update) Child Point
  const handleSaveChildPoint = async () => {
    if (!pointCoords || !pointName.trim() || !inst || !currentPolygon) return;

    setSavingPoint(true);
    setErrorMsg("");

    // Build custom variables object
    const customVarsObj: Record<string, string> = {};
    customVarsList.forEach((v) => {
      if (v.key && v.value !== undefined) {
        customVarsObj[v.key] = v.value;
      }
    });

    try {
      if (editingChildPoint?.id) {
        // UPDATE (PATCH)
        const res = await fetch(`/api/institutions/${inst.id}/child-points/${editingChildPoint.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: pointName.trim(),
            category: pointCategory,
            latitude: pointCoords.lat,
            longitude: pointCoords.lng,
            polygon_id: currentPolygon.id,
            polygon_name: currentPolygon.name,
            notes: pointNotes.trim(),
            custom_variables: customVarsObj,
          }),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Gagal memperbarui titik fasilitas.");

        setChildPoints((prev) =>
          prev.map((p) =>
            p.id === editingChildPoint.id
              ? {
                  ...p,
                  name: pointName.trim(),
                  category: pointCategory,
                  latitude: pointCoords.lat,
                  longitude: pointCoords.lng,
                  notes: pointNotes.trim(),
                  customVariables: customVarsObj,
                }
              : p
          )
        );

        setSuccessMsg(`Fasilitas '${pointName.trim()}' berhasil diperbarui!`);
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        // CREATE (POST)
        const res = await fetch(`/api/institutions/${inst.id}/child-points`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: pointName.trim(),
            category: pointCategory,
            latitude: pointCoords.lat,
            longitude: pointCoords.lng,
            polygon_id: currentPolygon.id,
            polygon_name: currentPolygon.name,
            notes: pointNotes.trim(),
            custom_variables: customVarsObj,
          }),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Gagal menambahkan titik fasilitas.");

        const created: ChildPointItem = {
          id: result.data?.id,
          institutionId: inst.id,
          polygonId: currentPolygon.id,
          polygonName: currentPolygon.name,
          name: pointName.trim(),
          category: pointCategory,
          latitude: pointCoords.lat,
          longitude: pointCoords.lng,
          notes: pointNotes.trim(),
          customVariables: customVarsObj,
        };

        setChildPoints((prev) => [...prev, created]);
        setSuccessMsg(`Fasilitas '${pointName.trim()}' berhasil ditambahkan ke bidang ini!`);
        setTimeout(() => setSuccessMsg(""), 3000);
      }

      handleCancelPointForm();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingPoint(false);
    }
  };

  // Delete child point
  const handleDeleteChildPoint = async (pointId: string | number) => {
    const target = childPoints.find((p) => p.id === pointId);
    if (!confirm(`Hapus titik fasilitas '${target?.name || "ini"}' dari bidang tanah ini?`)) return;

    try {
      const res = await fetch(`/api/institutions/${inst.id}/child-points/${pointId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Gagal menghapus titik fasilitas.");
      }
      setChildPoints((prev) => prev.filter((p) => p.id !== pointId));
      if (editingChildPoint?.id === pointId) handleCancelPointForm();
      setSuccessMsg("Titik fasilitas berhasil dihapus.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm font-medium">Memuat editor bidang polygon...</p>
      </div>
    );
  }

  if (!currentPolygon) {
    return (
      <div className="h-screen w-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-base font-bold text-zinc-900">Bidang Polygon Tidak Ditemukan</h2>
        <p className="text-xs text-zinc-500 max-w-sm">
          {errorMsg || "Bidang polygon yang ingin diedit tidak terdaftar pada institusi ini."}
        </p>
        <button
          type="button"
          onClick={() => router.push(backUrl)}
          className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold"
        >
          Kembali ke Formulir
        </button>
      </div>
    );
  }

  const vertexCount = currentPolygon.coordinates ? currentPolygon.coordinates.length : 0;
  const currentArea =
    currentPolygon.area_m2 || calculateAreaM2(toLeafletLatLngs(currentPolygon.coordinates));

  return (
    <div className="h-screen w-screen bg-zinc-50 text-zinc-800 font-sans flex flex-col overflow-hidden">
      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedDialog && (
        <UnsavedChangesDialog
          onSave={() => handleSave(true)}
          onDiscard={() => {
            setShowUnsavedDialog(false);
            setIsDirty(false);
            router.push(backUrl);
          }}
          onCancel={() => setShowUnsavedDialog(false)}
          saving={saving}
        />
      )}

      {/* Top Navbar */}
      <header className="h-14 bg-white border-b border-zinc-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-xs z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-600 hover:text-zinc-900 transition-colors flex items-center gap-1 text-xs font-semibold"
            title="Kembali ke Edit Profil Institusi"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Kembali</span>
          </button>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-2">
            <h1 className="text-xs sm:text-sm font-bold text-zinc-900 truncate max-w-xs sm:max-w-md">
              Edit: {currentPolygon.name}
            </h1>
            <code className="hidden md:inline text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">
              ID: {currentPolygon.id}
            </code>
            {isDirty && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                Belum Disimpan
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              type="button"
              disabled={saving || deleting}
              onClick={handleReset}
              className="px-3 py-2 bg-zinc-100 hover:bg-amber-50 text-zinc-700 hover:text-amber-800 border border-zinc-200 hover:border-amber-300 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
              title="Batalkan semua perubahan dan kembali ke bentuk awal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Perubahan</span>
            </button>
          )}

          <button
            type="button"
            disabled={deleting || saving}
            onClick={handleDeletePolygon}
            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
            title="Hapus bidang ini"
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Hapus Bidang</span>
          </button>

          <button
            type="button"
            disabled={saving || deleting || vertexCount < 3}
            onClick={() => handleSave(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side Panel (Collapsible Drawer) */}
        <div
          className={`bg-white border-r border-zinc-200 shrink-0 flex flex-col justify-between overflow-y-auto z-20 transition-all duration-300 ease-in-out ${
            isSidebarOpen
              ? "w-full md:w-96 p-4 opacity-100"
              : "w-0 p-0 opacity-0 border-r-0 pointer-events-none"
          }`}
        >
          <div className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span className="flex-1">{errorMsg}</span>
                <button type="button" onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span className="flex-1">{successMsg}</span>
              </div>
            )}

            {/* Polygon Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nama Bidang Tanah</span>
              </label>
              <input
                type="text"
                value={currentPolygon.name}
                onChange={(e) => {
                  setCurrentPolygon((prev) => (prev ? { ...prev, name: e.target.value } : null));
                  setIsDirty(true);
                }}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Metric Summary */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 space-y-2">
              <div className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Spesifikasi Bidang</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-zinc-200">
                  <span className="text-[10px] text-zinc-400 block">Titik Vertex</span>
                  <span className="text-sm font-bold text-zinc-900 font-mono">
                    {vertexCount} Titik
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-zinc-200">
                  <span className="text-[10px] text-zinc-400 block">Luas Area</span>
                  <span className="text-xs font-bold text-emerald-700 font-mono">
                    {currentArea.toLocaleString("id-ID")} m²
                  </span>
                  <span className="text-[10px] text-zinc-400 block">
                    ({(currentArea / 10000).toFixed(2)} Ha)
                  </span>
                </div>
              </div>
            </div>

            {/* Reset Warning Alert Box if Dirty */}
            {isDirty && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Ada Perubahan Belum Disimpan</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Bidang ini telah dimodifikasi. Anda dapat membatalkan perubahan atau menyimpannya.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset ke Awal</span>
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave(false)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                  >
                    <Save className="w-3 h-3" />
                    <span>Simpan Sekarang</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── CHILD POINTS SECTION (RICH DATA MATCHING 01375) ───────────── */}
            <div className="space-y-3 pt-3 border-t border-zinc-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                  <Building className="w-3.5 h-3.5 text-purple-600" />
                  <span>Fasilitas di Bidang Ini ({childPoints.length})</span>
                </div>
                {!isPickingChildPoint && !editingChildPoint && !pointCoords && (
                  <button
                    type="button"
                    onClick={handleStartAddPoint}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Titik Baru</span>
                  </button>
                )}
              </div>

              {/* Guide banner when in picking mode */}
              {isPickingChildPoint && !pointCoords && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900 space-y-2 animate-pulse">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-purple-800">
                      <Crosshair className="w-4 h-4 text-purple-600" />
                      Klik Peta untuk Menandai Titik
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelPointForm}
                      className="text-purple-500 hover:text-purple-800 font-semibold text-[11px]"
                    >
                      Batal
                    </button>
                  </div>
                  <p className="text-[11px] text-purple-700 leading-relaxed">
                    Klik pada area di dalam polygon hijau untuk meletakkan titik gedung / fasilitas. Pin merah akan langsung muncul.
                  </p>
                </div>
              )}

              {/* ── FORM TAMBAH / EDIT CHILD POINT LENGKAP ─────────────────── */}
              {(pointCoords || editingChildPoint) && (
                <div className="p-3.5 bg-zinc-50 border-2 border-purple-200 rounded-2xl space-y-3 text-xs shadow-sm">
                  <div className="flex items-center justify-between font-bold text-zinc-900 border-b border-zinc-200 pb-2">
                    <span className="flex items-center gap-1.5 text-purple-800">
                      {editingChildPoint ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {editingChildPoint ? "Edit Data Fasilitas" : "Form Fasilitas Baru"}
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelPointForm}
                      className="text-zinc-400 hover:text-zinc-700 p-1"
                      title="Tutup Form"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Koordinat Info & Relocate Button */}
                  {pointCoords && (
                    <div className="p-2.5 bg-white border border-purple-200 rounded-xl flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-semibold">Koordinat Terpasang:</span>
                        <code className="font-mono font-bold text-purple-900">
                          {pointCoords.lat.toFixed(6)}, {pointCoords.lng.toFixed(6)}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPickingChildPoint(true)}
                        className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                        title="Klik ulang di peta untuk pindah posisi"
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>Pindah Pin</span>
                      </button>
                    </div>
                  )}

                  {/* Nama Fasilitas */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700">Nama Gedung / Fasilitas *</label>
                    <input
                      type="text"
                      value={pointName}
                      onChange={(e) => setPointName(e.target.value)}
                      placeholder="Contoh: Gedung Rektorat Ir. (HC) Soekarno"
                      className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  {/* Kategori */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700">Kategori Fasilitas *</label>
                    <select
                      value={pointCategory}
                      onChange={(e) => setPointCategory(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Catatan / Keterangan */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700">Keterangan / Fungsi</label>
                    <input
                      type="text"
                      value={pointNotes}
                      onChange={(e) => setPointNotes(e.target.value)}
                      placeholder="Contoh: Pusat administrasi universitas, kapasitas 2.500 santri"
                      className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  {/* Spesifikasi / Variabel Kustom (JSON) seperti ID 01375 */}
                  <div className="space-y-2 pt-2 border-t border-zinc-200">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-800">
                        Spesifikasi Detail (Variabel Kustom)
                      </label>
                      <span className="text-[10px] text-zinc-400">JSON Field</span>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-1">
                      {PRESET_VARIABLES.map((preset) => {
                        const exists = customVarsList.some((v) => v.key === preset.key);
                        if (exists) return null;
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => handleAddCustomVar(preset.key, preset.label)}
                            className="px-2 py-0.5 bg-zinc-100 hover:bg-purple-50 text-zinc-700 hover:text-purple-700 border border-zinc-200 rounded-md text-[10px] font-medium transition-all"
                          >
                            + {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* List of Custom Variables */}
                    {customVarsList.length > 0 && (
                      <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-zinc-200 max-h-40 overflow-y-auto">
                        {customVarsList.map((item, idx) => (
                          <div key={item.key || idx} className="flex items-center gap-1.5">
                            <span className="w-28 shrink-0 text-[10px] font-bold text-zinc-600 truncate" title={item.label}>
                              {item.label}:
                            </span>
                            <input
                              type="text"
                              value={item.value}
                              onChange={(e) => handleCustomVarValueChange(idx, e.target.value)}
                              placeholder="Nilai..."
                              className="flex-1 px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomVar(idx)}
                              className="text-zinc-400 hover:text-red-600 p-0.5"
                              title="Hapus variabel ini"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Custom Field Manually */}
                    <div className="flex items-center gap-1 pt-1">
                      <input
                        type="text"
                        value={newVarKey}
                        onChange={(e) => setNewVarKey(e.target.value)}
                        placeholder="Nama Variabel Baru..."
                        className="w-1/2 px-2 py-1 bg-white border border-zinc-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <input
                        type="text"
                        value={newVarVal}
                        onChange={(e) => setNewVarVal(e.target.value)}
                        placeholder="Nilai..."
                        className="w-1/2 px-2 py-1 bg-white border border-zinc-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        disabled={!newVarKey.trim()}
                        onClick={handleAddCustomVarManual}
                        className="px-2 py-1 bg-zinc-200 hover:bg-purple-600 hover:text-white rounded-lg text-[11px] font-bold transition-all disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Submit / Cancel Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-200">
                    <button
                      type="button"
                      disabled={savingPoint || !pointName.trim() || !pointCoords}
                      onClick={handleSaveChildPoint}
                      className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                    >
                      {savingPoint ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>{editingChildPoint ? "Simpan Perubahan Fasilitas" : "Simpan Fasilitas Baru"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPointForm}
                      className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {/* ── DAFTAR FASILITAS DI BIDANG INI ──────────────────────────── */}
              {childPoints.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {childPoints.map((cp) => {
                    const color = CHILD_CATEGORY_COLORS[cp.category?.toLowerCase()] || "#6366f1";
                    const rawVars = cp.customVariables || (cp as any).custom_variables;
                    const varCount = rawVars && typeof rawVars === "object" ? Object.keys(rawVars).length : 0;
                    const isSelected = editingChildPoint?.id === cp.id;

                    return (
                      <div
                        key={cp.id}
                        className={`p-2.5 bg-white border rounded-2xl space-y-1.5 transition-all shadow-2xs ${
                          isSelected
                            ? "border-purple-500 ring-2 ring-purple-100 bg-purple-50/20"
                            : "border-zinc-200 hover:border-purple-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <div
                              className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: color }}
                            />
                            <div className="truncate">
                              <span className="font-bold text-zinc-900 block truncate text-xs">
                                {cp.name}
                              </span>
                              <span className="text-[10px] text-zinc-400 capitalize">
                                {cp.category}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons: Edit, Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditPoint(cp)}
                              className="p-1.5 bg-zinc-50 hover:bg-purple-100 text-zinc-600 hover:text-purple-700 rounded-lg transition-colors"
                              title="Edit fasilitas ini"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {cp.id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteChildPoint(cp.id!)}
                                className="p-1.5 bg-zinc-50 hover:bg-red-100 text-zinc-600 hover:text-red-700 rounded-lg transition-colors"
                                title="Hapus fasilitas ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Summary of Variables & Notes */}
                        {(varCount > 0 || cp.notes) && (
                          <div className="text-[10px] text-zinc-500 border-t border-zinc-100 pt-1.5 space-y-0.5">
                            {rawVars && typeof rawVars === "object" && !Array.isArray(rawVars) && (
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(rawVars).slice(0, 3).map(([k, val]) => (
                                  <span key={k} className="bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] text-zinc-700 font-mono">
                                    {k.replace(/_/g, " ")}: {String(val)}
                                  </span>
                                ))}
                                {Object.keys(rawVars).length > 3 && (
                                  <span className="text-zinc-400 text-[10px]">+{Object.keys(rawVars).length - 3} lagi</span>
                                )}
                              </div>
                            )}
                            {cp.notes && <p className="italic text-zinc-400 truncate">{cp.notes}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-zinc-400 italic bg-zinc-50/50 p-3 rounded-2xl border border-dashed border-zinc-200 text-center">
                  Belum ada fasilitas di bidang ini. Klik <b>+ Titik Baru</b> untuk menandai gedung atau sarana di atas peta.
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 text-[10px] text-zinc-400 text-center">
            Editor Independen • {currentPolygon.name}
          </div>
        </div>

        {/* Map Canvas */}
        <div className="flex-1 h-full w-full relative">
          <SinglePolygonEditor
            initialCenter={centerCoords}
            polygon={currentPolygon}
            otherPolygons={allPolygons}
            childPoints={childPoints}
            onPolygonChange={handlePolygonChange}
            isPickingChildPoint={isPickingChildPoint}
            onPickChildPoint={(lat, lng) => {
              setPointCoords({ lat, lng });
              setIsPickingChildPoint(false);
            }}
            pickedCoords={pointCoords}
            pickedLabel={
              pointName.trim()
                ? pointName.trim()
                : editingChildPoint?.name
                ? editingChildPoint.name
                : "Titik Fasilitas Baru"
            }
            onPickedCoordsChange={(lat, lng) => setPointCoords({ lat, lng })}
            onSelectChildPoint={(cp) => handleStartEditPoint(cp)}
            selectedChildPointId={editingChildPoint?.id}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
          />
        </div>
      </div>
    </div>
  );
}

export default function EditPolygonPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm">Memuat editor polygon...</p>
        </div>
      }
    >
      <EditPolygonContent paramsPromise={params} />
    </Suspense>
  );
}
