"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Building,
  MapPin,
  Layers,
  Save,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
  LogOut,
  ArrowLeft,
  FileText,
  Plus,
  Trash2,
  Edit2,
  Check,
  Tag,
  Crosshair,
  Info,
} from "lucide-react";
import ChildPointsManager from "@/components/map/ChildPointsManager";
import {
  normalizePolygons,
  InstitutionPolygon,
  ChildPointItem,
  toLeafletLatLngs,
  calculateAreaM2,
  POLYGON_PALETTE,
} from "@/lib/geometry";

// Dynamically load PolygonMapEditor to avoid Leaflet SSR issues
const PolygonMapEditor = dynamic(
  () => import("@/components/map/PolygonMapEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mr-2" />
        <span>Memuat peta editor polygon & child points...</span>
      </div>
    ),
  }
);

function PolygonEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitId = searchParams.get("id");
  const targetPolyId = searchParams.get("polyId");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [inst, setInst] = useState<any>(null);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);

  // Multi-Polygon State
  const [polygons, setPolygons] = useState<InstitutionPolygon[]>([]);
  const [activePolyId, setActivePolyId] = useState<string>("poly-1");
  const [childPoints, setChildPoints] = useState<ChildPointItem[]>([]);
  const [verificationStatus, setVerificationStatus] = useState("valid");

  // Interactive Map Pick State for Child Points
  const [isPickingChildPoint, setIsPickingChildPoint] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{
    lat: number;
    lng: number;
    polygonId?: string;
    polygonName?: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = explicitId
      ? `/api/institusi/me?id=${explicitId}`
      : "/api/institusi/me";

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

        setUser(data.user);
        const item = data.institution;
        setInst(item);
        setVerificationStatus(item.verificationStatus || "valid");

        if (item.latitude && item.longitude) {
          setCoordinates([item.latitude, item.longitude]);
        }

        // Fetch child points
        fetch(`/api/institutions/${item.id}`)
          .then((res) => res.json())
          .then((fullInst) => {
            if (fullInst.child_points) {
              const formattedChilds: ChildPointItem[] = fullInst.child_points.map((cp: any) => ({
                id: cp.id,
                institutionId: item.id,
                polygonId: cp.polygon_id,
                polygonName: cp.polygon_name,
                name: cp.name,
                category: cp.category,
                latitude: cp.latitude,
                longitude: cp.longitude,
                customVariables: cp.custom_variables,
                notes: cp.notes,
              }));

              setChildPoints(formattedChilds);

              const normalizedPolys = normalizePolygons(
                item.landGeometry,
                item.name || "Kampus Utama",
                formattedChilds
              );
              setPolygons(normalizedPolys);
              if (normalizedPolys.length > 0) {
                const foundTarget = targetPolyId
                  ? normalizedPolys.find((p) => p.id === targetPolyId)
                  : null;
                setActivePolyId(foundTarget ? foundTarget.id : normalizedPolys[0].id);
              }
            } else {
              const normalizedPolys = normalizePolygons(
                item.landGeometry,
                item.name || "Kampus Utama"
              );
              setPolygons(normalizedPolys);
              if (normalizedPolys.length > 0) {
                const foundTarget = targetPolyId
                  ? normalizedPolys.find((p) => p.id === targetPolyId)
                  : null;
                setActivePolyId(foundTarget ? foundTarget.id : normalizedPolys[0].id);
              }
            }
          })
          .catch((err) => {
            console.error("Error loading full inst:", err);
            const normalizedPolys = normalizePolygons(
              item.landGeometry,
              item.name || "Kampus Utama"
            );
            setPolygons(normalizedPolys);
          });
      })
      .catch((err) => {
        console.error(err);
        setErrorMsg("Terjadi kesalahan memuat data.");
      })
      .finally(() => setLoading(false));
  }, [explicitId, router]);

  const handlePolygonsChange = (
    updatedPolys: InstitutionPolygon[],
    totalArea: number
  ) => {
    setPolygons(updatedPolys);
  };

  const handleCoordinatesChange = (newCoords: [number, number]) => {
    setCoordinates(newCoords);
  };

  const handlePickChildPointOnMap = (
    lat: number,
    lng: number,
    polygonId?: string,
    polygonName?: string
  ) => {
    setPickedCoords({ lat, lng, polygonId, polygonName });
    setIsPickingChildPoint(false);
  };

  const handleSaveAllPolygons = async () => {
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    // Calculate total area
    const totalAreaM2 = polygons.reduce((acc, p) => acc + (p.area_m2 || 0), 0);

    // Embed child points inside each polygon object
    const finalPolygonsToSave = polygons.map((poly) => {
      const polyChilds = childPoints.filter(
        (cp) => cp.polygonId === poly.id || cp.polygonName === poly.name
      );
      return {
        ...poly,
        child_points: polyChilds,
      };
    });

    const payload = {
      latitude: coordinates ? coordinates[0] : null,
      longitude: coordinates ? coordinates[1] : null,
      landTotalAreaM2: totalAreaM2,
      landGeometry: finalPolygonsToSave,
    };

    try {
      const url = explicitId
        ? `/api/institusi/me?id=${explicitId}`
        : "/api/institusi/me";

      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal menyimpan polygon.");
      }

      setVerificationStatus("pengajuan");
      setSuccessMsg(
        "Bidang polygon dan titik fasilitas (child points) berhasil disimpan! Status institusi kini 'Pengajuan' dan siap diverifikasi oleh Admin."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm">Memuat editor polygon & child points...</p>
      </div>
    );
  }

  const activePoly = polygons.find((p) => p.id === activePolyId);
  const activePolyChildPoints = childPoints.filter(
    (cp) => cp.polygonId === activePolyId || (activePoly && cp.polygonName === activePoly.name)
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 font-sans pb-24">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(explicitId ? `/institusi/edit?id=${explicitId}` : "/institusi/edit")}
            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-900 transition-colors"
            title="Kembali ke Edit Profil Institusi"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-zinc-900">
                Editor Polygon & Child Points — {inst?.name || "Institusi"}
              </h1>
              {inst?.id && (
                <code className="text-[11px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-mono">
                  ID: {inst.id}
                </code>
              )}
            </div>
            <p className="text-[11px] text-zinc-500">
              Setiap polygon (misal: Kampus 1, Kampus 2) memiliki titik fasilitas (child points) tersendiri di dalamnya.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {user && (
            <div className="hidden sm:flex flex-col text-right">
              <span className="font-semibold text-zinc-900">{user.name}</span>
              <span className="text-[10px] text-zinc-400 capitalize">
                Role: {user.role.replace("_", " ")}
              </span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 hover:bg-red-50 text-zinc-600 hover:text-red-600 rounded-xl border border-zinc-200 font-medium flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 pt-6 space-y-6">
        {/* Banner Status Verifikasi */}
        {verificationStatus === "pengajuan" && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 shadow-xs text-xs text-amber-900">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <div className="font-bold text-sm text-amber-950 flex items-center gap-2">
                <span>Status Data: Pengajuan Perubahan (Menunggu Verifikasi Admin)</span>
              </div>
              <p>
                Perubahan polygon dan child points yang Anda kirimkan saat ini sedang dalam status peninjauan oleh Admin SIS-LPI.
              </p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-100/80 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Peta Editor Interactive Multi-Polygon & Point Picking */}
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-4">
          <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                <span>Peta Spasial Multi-Polygon &amp; Penataan Child Points</span>
              </h2>
              <p className="text-xs text-zinc-500">
                Pilih atau buat bidang polygon baru (misal: Kampus 1, Kampus 2), lalu tambahkan titik fasilitas gedung tepat di dalamnya.
              </p>
            </div>
          </div>

          <PolygonMapEditor
            initialCoordinates={coordinates}
            polygons={polygons}
            childPoints={childPoints}
            onCoordinatesChange={handleCoordinatesChange}
            onPolygonsChange={handlePolygonsChange}
            isPickingChildPoint={isPickingChildPoint}
            onPickChildPoint={handlePickChildPointOnMap}
          />
        </div>

        {/* Section 2: Kelola Child Points per Polygon Terpilih */}
        <ChildPointsManager
          institutionId={inst?.id}
          childPoints={childPoints}
          polygons={polygons}
          onChange={setChildPoints}
          onStatusChange={setVerificationStatus}
          isPickingPoint={isPickingChildPoint}
          onStartPickPoint={() => setIsPickingChildPoint(true)}
          pickedCoords={pickedCoords}
        />

        {/* Sticky Save Action */}
        <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-zinc-300/80 shadow-xl flex items-center justify-between gap-4">
          <div className="text-xs text-zinc-600">
            <span className="font-semibold text-zinc-900 block">
              Simpan Struktur Polygon &amp; Child Points
            </span>
            <span>
              Seluruh polygon dan titik fasilitas internal akan disimpan dan diajukan ke Admin.
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveAllPolygons}
            disabled={saving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 shrink-0"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan Polygon...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Seluruh Polygon &amp; Child Points</span>
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function PolygonEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm">Memuat editor polygon...</p>
        </div>
      }
    >
      <PolygonEditorContent />
    </Suspense>
  );
}
