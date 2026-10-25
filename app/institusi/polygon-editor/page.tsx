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
    <div className="h-screen w-screen bg-zinc-50 text-zinc-800 font-sans flex flex-col overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 bg-white border-b border-zinc-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-xs z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(explicitId ? `/institusi/edit?id=${explicitId}` : "/institusi/edit")}
            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-600 hover:text-zinc-900 transition-colors flex items-center gap-1 text-xs font-semibold"
            title="Kembali ke Edit Profil Institusi"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Kembali</span>
          </button>
          <div className="h-4 w-px bg-zinc-200" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-bold text-zinc-900 line-clamp-1">
                Editor Full-Screen Polygon — {inst?.name || "Institusi"}
              </h1>
              {inst?.id && (
                <code className="hidden sm:inline text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-mono">
                  ID: {inst.id}
                </code>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleSaveAllPolygons}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
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

          <button
            onClick={handleLogout}
            className="p-2 hover:bg-red-50 text-zinc-500 hover:text-red-600 rounded-xl border border-zinc-200 font-medium transition-colors"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Full-Screen Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Full-Screen Map Area */}
        <div className="flex-1 h-full w-full relative overflow-hidden bg-zinc-100">
          {successMsg && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-500 max-w-lg w-full px-4">
              <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-lg flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
                <button onClick={() => setSuccessMsg("")} className="text-white/80 hover:text-white">✕</button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-500 max-w-lg w-full px-4">
              <div className="p-3 bg-red-600 text-white rounded-xl text-xs font-semibold shadow-lg flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button onClick={() => setErrorMsg("")} className="text-white/80 hover:text-white">✕</button>
              </div>
            </div>
          )}

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

        {/* Sidebar Panel for Managing Child Points */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-zinc-200 bg-white h-72 lg:h-full flex flex-col shrink-0 shadow-lg z-10 overflow-y-auto p-4">
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
