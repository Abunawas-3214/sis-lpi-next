"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
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
  Info,
  RotateCcw,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  normalizePolygons,
  InstitutionPolygon,
  calculateAreaM2,
  toLeafletLatLngs,
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

// ── Unsaved Changes Dialog Modal ───────────────────────────────────────────────
function UnsavedChangesDialog({
  onSave,
  onDiscard,
  onCancel,
  saving,
  canSave,
}: {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  saving: boolean;
  canSave: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shrink-0 mt-0.5">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900">Bidang Baru Belum Disimpan</h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Anda sedang membuat bidang polygon baru dan belum menyimpannya. Apakah Anda ingin menyimpan bidang ini atau membatalkannya?
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100">
          {canSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Simpan Bidang & Kembali</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-red-50 text-zinc-700 hover:text-red-700 border border-zinc-200 hover:border-red-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <Trash2 className="w-4 h-4" />
            <span>Buang Bidang Baru & Kembali</span>
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

function TambahPolygonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [inst, setInst] = useState<any>(null);
  const [centerCoords, setCenterCoords] = useState<[number, number] | null>(null);
  const [existingPolygons, setExistingPolygons] = useState<InstitutionPolygon[]>([]);

  // The new independent polygon being created
  const [newPolygon, setNewPolygon] = useState<InstitutionPolygon>({
    id: `poly-new-${Date.now()}`,
    name: "Bidang Baru",
    coordinates: [],
    area_m2: 0,
  });

  // Dirty tracking & Unsaved Dialog
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Drawer Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
      .then((data) => {
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
        setExistingPolygons(normalized);

        // Pre-fill a descriptive name
        const nextNumber = normalized.length + 1;
        setNewPolygon({
          id: `poly-${item.id}-${nextNumber}-${Date.now().toString().slice(-4)}`,
          name: `Bidang ${nextNumber}`,
          coordinates: [],
          area_m2: 0,
        });
        setIsDirty(false);
      })
      .catch((err) => {
        console.error(err);
        setErrorMsg("Terjadi kesalahan memuat data institusi.");
      })
      .finally(() => setLoading(false));
  }, [explicitId, router]);

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

  // Polygon change handler
  const handlePolygonChange = useCallback((updated: InstitutionPolygon) => {
    setNewPolygon(updated);
    setIsDirty(true);
  }, []);

  // Reset polygon (clear all coordinates)
  const handleReset = () => {
    if (newPolygon.coordinates.length === 0) return;
    if (confirm("Kosongkan semua titik yang telah digambar pada bidang ini?")) {
      setNewPolygon((prev) => ({
        ...prev,
        coordinates: [],
        area_m2: 0,
      }));
      setIsDirty(false);
      setErrorMsg("");
      setSuccessMsg("Semua titik vertex berhasil direset.");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  // Back button click with dirty check
  const handleBack = () => {
    if (isDirty && newPolygon.coordinates.length > 0) {
      setShowUnsavedDialog(true);
    } else {
      router.push(backUrl);
    }
  };

  const handleSave = async (andNavigate = true) => {
    if (!newPolygon.name.trim()) {
      setErrorMsg("Nama bidang tanah wajib diisi.");
      setShowUnsavedDialog(false);
      return;
    }

    if (!newPolygon.coordinates || newPolygon.coordinates.length < 3) {
      setErrorMsg("Bidang tanah harus memiliki minimal 3 titik vertex keliling.");
      setShowUnsavedDialog(false);
      return;
    }

    setSaving(true);
    setErrorMsg("");

    const calculatedArea =
      newPolygon.area_m2 || calculateAreaM2(toLeafletLatLngs(newPolygon.coordinates));

    const finalNewPoly: InstitutionPolygon = {
      ...newPolygon,
      name: newPolygon.name.trim(),
      area_m2: calculatedArea,
    };

    const updatedPolygonsList = [...existingPolygons, finalNewPoly];
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
        throw new Error(result.error || "Gagal menyimpan bidang polygon baru.");
      }

      setIsDirty(false);
      setShowUnsavedDialog(false);

      if (andNavigate) {
        setSuccessMsg("Bidang polygon berhasil ditambahkan! Mengalihkan ke formulir lembaga...");
        setTimeout(() => {
          router.push(backUrl);
        }, 700);
      } else {
        setSuccessMsg("Bidang polygon berhasil disimpan!");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm font-medium">Memuat data institusi...</p>
      </div>
    );
  }

  const vertexCount = newPolygon.coordinates.length;
  const currentArea = newPolygon.area_m2 || 0;

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
          canSave={vertexCount >= 3}
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
            <h1 className="text-xs sm:text-sm font-bold text-zinc-900">
              Tambah Bidang Polygon Baru
            </h1>
            <span className="hidden md:inline text-xs text-zinc-400">—</span>
            <span className="hidden md:inline text-xs text-zinc-600 font-medium truncate max-w-xs">
              {inst?.name || "Institusi"}
            </span>
            {isDirty && vertexCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                Belum Disimpan
              </span>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {vertexCount > 0 && (
            <button
              type="button"
              disabled={saving}
              onClick={handleReset}
              className="px-3 py-2 bg-zinc-100 hover:bg-amber-50 text-zinc-700 hover:text-amber-800 border border-zinc-200 hover:border-amber-300 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
              title="Reset semua titik gambar yang baru dibuat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Gambar</span>
            </button>
          )}

          <button
            type="button"
            disabled={saving || vertexCount < 3}
            onClick={() => handleSave(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Bidang Baru</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content: Sidebar + Full Map */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side Control Panel (Collapsible Drawer) */}
        <div
          className={`bg-white border-r border-zinc-200 shrink-0 flex flex-col justify-between overflow-y-auto z-20 transition-all duration-300 ease-in-out ${
            isSidebarOpen
              ? "w-full md:w-80 p-4 opacity-100"
              : "w-0 p-0 opacity-0 border-r-0 pointer-events-none"
          }`}
        >
          <div className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Polygon Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nama Bidang Tanah</span>
              </label>
              <input
                type="text"
                value={newPolygon.name}
                onChange={(e) => {
                  setNewPolygon((prev) => ({ ...prev, name: e.target.value }));
                  setIsDirty(true);
                }}
                placeholder="Contoh: Kampus 2 (Lahan Perluasan)"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-zinc-400">
                Beri nama pembeda jika institusi memiliki beberapa lokasi bidang lahan terpisah.
              </p>
            </div>

            {/* Metric Summary Card */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 space-y-2">
              <div className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Metrik Bidang Ini</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-zinc-200">
                  <span className="text-[10px] text-zinc-400 block">Jumlah Titik</span>
                  <span className="text-sm font-bold text-zinc-900 font-mono">
                    {vertexCount} Vertex
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-zinc-200">
                  <span className="text-[10px] text-zinc-400 block">Estimasi Luas</span>
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
            {isDirty && vertexCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Bidang Belum Disimpan</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  {vertexCount < 3
                    ? `Perlu minimal 3 titik untuk disimpan (saat ini ${vertexCount} titik).`
                    : "Titik telah digambar. Simpan bidang atau reset untuk mulai ulang."}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Gambar</span>
                  </button>
                  {vertexCount >= 3 && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSave(false)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                    >
                      <Save className="w-3 h-3" />
                      <span>Simpan Sekarang</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-[11px] text-emerald-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1 text-emerald-800">
                <Info className="w-3.5 h-3.5" />
                <span>Petunjuk Menggambar:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-emerald-950/80">
                <li>Klik pada peta satelit untuk menandai batas sudut keliling lahan.</li>
                <li>Minimal 3 titik untuk membentuk bidang tertutup.</li>
                <li>Gunakan panel alat di sisi kiri peta untuk pindah, sisip, atau hapus titik.</li>
                <li>Garis abu-abu putus-putus menunjukkan bidang lahan lain yang sudah terdaftar.</li>
              </ul>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 text-[10px] text-zinc-400 text-center">
            SIS-LPI Spatial Engine • Editor Independen
          </div>
        </div>

        {/* Map Canvas */}
        <div className="flex-1 h-full w-full relative">
          <SinglePolygonEditor
            initialCenter={centerCoords}
            polygon={newPolygon}
            otherPolygons={existingPolygons}
            childPoints={[]}
            onPolygonChange={handlePolygonChange}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
          />
        </div>
      </div>
    </div>
  );
}

export default function TambahPolygonPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm">Memuat editor polygon...</p>
        </div>
      }
    >
      <TambahPolygonContent />
    </Suspense>
  );
}
