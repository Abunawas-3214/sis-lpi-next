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
  ShieldCheck,
  Check,
  Info,
  Plus,
  Edit3,
  Lock,
  History,
  Trash2,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
  Eye,
  GitCompare,
  X,
  User,
} from "lucide-react";
import { normalizePolygons, InstitutionPolygon, ChildPointItem } from "@/lib/geometry";
import UserProfileModal from "@/components/profile/UserProfileModal";

const DynamicPolygonDiffMap = dynamic(() => import("@/components/map/PolygonDiffMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] bg-zinc-100 rounded-2xl flex items-center justify-center text-xs text-zinc-400 animate-pulse">
      Memuat Peta Komparasi Polygon...
    </div>
  ),
});

const MiniMap = dynamic(() => import("@/components/map/MiniMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 text-xs animate-pulse">
      Memuat peta polygon...
    </div>
  ),
});

const USE_CATEGORY_OPTIONS = [
  { id: "pendidikan", label: "Pendidikan (Gedung Sekolah/Kelas)" },
  { id: "asrama", label: "Asrama / Pondokan Santri" },
  { id: "ibadah", label: "Ibadah (Masjid / Musholla)" },
  { id: "ekonomi", label: "Ekonomi / Bisnis / Koperasi" },
  { id: "pertanian", label: "Pertanian / Perkebunan" },
  { id: "olahraga", label: "Fasilitas Olahraga" },
  { id: "lainnya", label: "Lainnya" },
];

function InstitutionEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Tabs: 'form' | 'riwayat'
  const [activeTab, setActiveTab] = useState<"form" | "riwayat">("form");
  const [isLocked, setIsLocked] = useState(false);
  const [historyBatches, setHistoryBatches] = useState<any[]>([]);
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  // Map Modal State for Spatial Preview (Same as Admin)
  const [previewMapModal, setPreviewMapModal] = useState<{
    isOpen: boolean;
    institutionName: string;
    coordinates: [number, number];
    previousPolygons: any[];
    newPolygons: any[];
    diff?: any;
    focusPolygonId?: string | null;
    initialMode?: "overlay" | "before" | "after";
    title?: string;
    subtitle?: string;
  } | null>(null);

  // Institution Form State
  const [inst, setInst] = useState<any>(null);
  const [provinces, setProvinces] = useState<string[]>([]);

  // Form Fields
  const [name, setName] = useState("");
  const [nomorDataLembaga, setNomorDataLembaga] = useState("");
  const [type, setType] = useState("pesantren");
  const [level, setLevel] = useState("menengah");
  const [status, setStatus] = useState("swasta");
  const [accreditation, setAccreditation] = useState("");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  // Land & Valuation Fields
  const [landTotalAreaM2, setLandTotalAreaM2] = useState<number | string>("");
  const [landCertificateStatus, setLandCertificateStatus] = useState("");
  const [landCertificateNumber, setLandCertificateNumber] = useState("");
  const [landUseCategories, setLandUseCategories] = useState<string[]>([]);
  const [landNjop, setLandNjop] = useState("");
  const [landPricePerM2, setLandPricePerM2] = useState("");
  const [landEstimatedTotalValue, setLandEstimatedTotalValue] = useState("");

  // Spatial / Polygon State
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [latitudeStr, setLatitudeStr] = useState("");
  const [longitudeStr, setLongitudeStr] = useState("");
  const [polygons, setPolygons] = useState<InstitutionPolygon[]>([]);
  const [childPoints, setChildPoints] = useState<ChildPointItem[]>([]);
  const [polygonGeometry, setPolygonGeometry] = useState<any>(null);
  const [parcels, setParcels] = useState<any[]>([]);
  const [verificationStatus, setVerificationStatus] = useState("valid");
  const [pendingPolygonIds, setPendingPolygonIds] = useState<string[]>([]);

  // Load provinces
  useEffect(() => {
    fetch("/api/provinces")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProvinces(data);
      })
      .catch(console.error);
  }, []);

  // Fetch institution data
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

        setName(item.name || "");
        setNomorDataLembaga(item.nomorDataLembaga || "");
        setType(item.type || "pesantren");
        setLevel(item.level || "menengah");
        setStatus(item.status || "swasta");
        setAccreditation(item.accreditation || "");
        setAddress(item.address || "");
        setProvince(item.province || "");
        setCity(item.city || "");
        setNotes(item.notes || "");

        setLandTotalAreaM2(item.landTotalAreaM2 || "");
        setLandCertificateStatus(item.landCertificateStatus || "Sertifikat Hak Milik (SHM)");
        setLandCertificateNumber(item.landCertificateNumber || "");
        setLandUseCategories(Array.isArray(item.landUseCategories) ? item.landUseCategories : []);
        setLandNjop(item.landNjop || "");
        setLandPricePerM2(item.landPricePerM2 || "");
        setLandEstimatedTotalValue(item.landEstimatedTotalValue || "");

        const statusVerif = item.verificationStatus || "valid";
        setVerificationStatus(statusVerif);

        // Lock if status is 'pengajuan' or server returned isLocked
        const locked = Boolean(data.isLocked || statusVerif === "pengajuan");
        setIsLocked(locked);
        setPendingPolygonIds(data.pendingPolygonIds || []);

        // History submissions
        const batches = data.historyBatches || [];
        setHistoryBatches(batches);
        if (batches.length > 0) {
          setExpandedBatches({ [batches[0].batchId]: true });
        }

        if (searchParams.get("tab") === "riwayat") {
          setActiveTab("riwayat");
        }

        if (item.latitude && item.longitude) {
          setCoordinates([item.latitude, item.longitude]);
          setLatitudeStr(String(item.latitude));
          setLongitudeStr(String(item.longitude));
        }

        // Multi-polygon normalization
        const normalizedPolys = normalizePolygons(item.landGeometry, item.name || "Bidang 1");
        setPolygons(normalizedPolys);
        setPolygonGeometry(item.landGeometry);

        if (item.landParcels && Array.isArray(item.landParcels)) {
          setParcels(item.landParcels);
        }

        // Fetch child facility points for this institution
        fetch(`/api/institutions/${item.id}/child-points`)
          .then((res) => res.json())
          .then((childData) => {
            if (childData.data) {
              setChildPoints(
                childData.data.map((cp: any) => ({
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
                }))
              );
            }
          })
          .catch((err) => console.error("Error fetching child points:", err));
      })
      .catch((err) => {
        console.error(err);
        setErrorMsg("Terjadi kesalahan memuat data.");
      })
      .finally(() => setLoading(false));
  }, [explicitId, router, searchParams]);

  const toggleCategory = (catId: string) => {
    if (isLocked) return;
    setLandUseCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const toggleBatchAccordion = (batchId: string) => {
    setExpandedBatches((prev) => ({
      ...prev,
      [batchId]: !prev[batchId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      setErrorMsg(
        "Pengajuan sebelumnya sedang dalam proses peninjauan oleh Admin. Anda tidak dapat melakukan perubahan data baru hingga pengajuan saat ini disetujui atau ditolak."
      );
      return;
    }

    // Client-side change detection: prevent empty submissions
    if (inst) {
      const isNameDiff = (name || "").trim() !== (inst.name || "").trim();
      const isNotesDiff = (notes || "").trim() !== (inst.notes || "").trim();
      const isAddressDiff = (address || "").trim() !== (inst.address || "").trim();
      const isCityDiff = (city || "").trim() !== (inst.city || "").trim();
      const isProvDiff = (province || "").trim() !== (inst.province || "").trim();
      const isTypeDiff = type !== inst.type;
      const isLevelDiff = level !== inst.level;
      const isStatusDiff = status !== inst.status;
      const isAccredDiff = (accreditation || "") !== (inst.accreditation || "");
      const isCertStatusDiff = landCertificateStatus !== (inst.landCertificateStatus || "Sertifikat Hak Milik (SHM)");
      const isCertNumDiff = (landCertificateNumber || "").trim() !== (inst.landCertificateNumber || "").trim();
      const isAreaDiff = String(landTotalAreaM2 || "").trim() !== String(inst.landTotalAreaM2 || "").trim();
      const isGeomDiff = JSON.stringify(polygonGeometry) !== JSON.stringify(inst.landGeometry);
      const isLatDiff = latitudeStr !== "" && parseFloat(latitudeStr) !== inst.latitude;
      const isLngDiff = longitudeStr !== "" && parseFloat(longitudeStr) !== inst.longitude;

      const hasAnyChange =
        isNameDiff ||
        isNotesDiff ||
        isAddressDiff ||
        isCityDiff ||
        isProvDiff ||
        isTypeDiff ||
        isLevelDiff ||
        isStatusDiff ||
        isAccredDiff ||
        isCertStatusDiff ||
        isCertNumDiff ||
        isAreaDiff ||
        isGeomDiff ||
        isLatDiff ||
        isLngDiff;

      if (!hasAnyChange) {
        setErrorMsg(
          "Tidak ada perubahan data atribut institusi maupun bidang polygon yang terdeteksi. Perubahan titik fasilitas gedung langsung tersimpan secara otomatis dan tidak perlu diajukan melalui tombol ini."
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    const payload = {
      name,
      nomorDataLembaga,
      type,
      level,
      status,
      accreditation,
      address,
      province,
      city,
      notes,
      landTotalAreaM2: landTotalAreaM2 ? parseFloat(String(landTotalAreaM2)) : null,
      landCertificateStatus,
      landCertificateNumber,
      landUseCategories,
      landNjop,
      landPricePerM2,
      landEstimatedTotalValue,
      latitude: latitudeStr ? parseFloat(latitudeStr) : (coordinates ? coordinates[0] : null),
      longitude: longitudeStr ? parseFloat(longitudeStr) : (coordinates ? coordinates[1] : null),
      landGeometry: polygonGeometry,
      landParcels: parcels,
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
        throw new Error(result.error || "Gagal menyimpan pengajuan.");
      }

      setVerificationStatus("pengajuan");
      setIsLocked(true);
      setSuccessMsg(
        "Perubahan keterangan dan polygon berhasil diajukan! Status institusi kini 'Pengajuan'. Formulir dikunci sementara hingga Admin menyelesaikan verifikasi."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Refresh history data
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          if (d.historyBatches) setHistoryBatches(d.historyBatches);
        });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {}
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm font-medium">Memuat profil dan riwayat institusi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 font-sans pb-24">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(inst ? `/institutions/${inst.id}` : "/")}
            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-900 transition-colors"
            title="Lihat Tampilan Publik"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-zinc-900">
                {name || "Panel Institusi"}
              </h1>
              {inst?.id && (
                <code className="text-[11px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-mono">
                  ID: {inst.id}
                </code>
              )}
              {isLocked && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>Pengajuan Terkunci</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500">
              Laman Edit Data Institusi, Pengajuan Keterangan, dan Penambahan Polygon
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

          {user && (
            <button
              onClick={() => setIsProfileOpen(true)}
              className="px-3 py-1.5 bg-zinc-50 hover:bg-emerald-50 text-zinc-700 hover:text-emerald-700 rounded-xl border border-zinc-200 font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Kelola Profil Akun & Kata Sandi"
            >
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Profil Akun</span>
            </button>
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
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-1.5 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("form")}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
                activeTab === "form"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Formulir Data & Aset Lahan</span>
              {isLocked && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] flex items-center gap-0.5 ${
                    activeTab === "form" ? "bg-emerald-700 text-emerald-100" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  <Lock className="w-2.5 h-2.5" />
                  <span>Terkunci</span>
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("riwayat")}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
                activeTab === "riwayat"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <History className="w-4 h-4" />
              <span>Riwayat Pengajuan Perubahan</span>
              {historyBatches.length > 0 && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    activeTab === "riwayat"
                      ? "bg-emerald-700 text-emerald-100"
                      : isLocked
                      ? "bg-amber-500 text-white animate-pulse"
                      : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {historyBatches.length}
                </span>
              )}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
            {isLocked ? (
              <span className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-xl">
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Menunggu Review Admin</span>
              </span>
            ) : verificationStatus === "valid" ? (
              <span className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Status Terverifikasi (Valid)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-rose-800 bg-rose-50 border border-rose-300 px-3 py-1.5 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Status Perlu Perbaikan</span>
              </span>
            )}
          </div>
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="p-4 bg-emerald-100/90 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: FORMULIR DATA & ASET LAHAN */}
        {/* ════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "form" && (
          <div className="space-y-6">
            {/* Banner Status Terkunci (Ketika Pengajuan Aktif) */}
            {isLocked ? (
              <div className="p-5 bg-amber-50/90 border-2 border-amber-300 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl shrink-0 mt-0.5">
                    <Lock className="w-5 h-5 text-amber-700" />
                  </div>
                  <div className="text-xs text-amber-950 space-y-1">
                    <div className="font-bold text-sm text-amber-950 flex items-center gap-2">
                      <span>Pengajuan Sedang Ditinjau Admin (Data & Polygon Terkunci)</span>
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[10px] font-bold">
                        Menunggu Persetujuan
                      </span>
                    </div>
                    <p className="text-amber-800 leading-relaxed max-w-2xl">
                      Institusi Anda telah mengirimkan usulan perubahan data/polygon. Untuk menjaga integritas data dan mencegah penimpaan perubahan yang sedang diperiksa, <b>seluruh formulir dan editor polygon dinonaktifkan sementara</b> hingga Admin selesai meninjau (disetujui atau ditolak).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {historyBatches.length > 0 && historyBatches[0].polygon && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewMapModal({
                          isOpen: true,
                          institutionName: name || inst?.name || "Institusi",
                          coordinates: coordinates || [-2.5, 108.0],
                          previousPolygons: historyBatches[0].polygon.previousPolygons || [],
                          newPolygons: historyBatches[0].polygon.newPolygons || [],
                          diff: historyBatches[0].polygon.diff,
                          focusPolygonId: null,
                          initialMode: "overlay",
                          title: `Pratinjau Usulan Polygon: ${name || inst?.name}`,
                          subtitle: "Peta komparasi sebelum (garis merah) vs usulan yang sedang diajukan (garis hijau/biru solid).",
                        })
                      }
                      className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Pratinjau Peta Usulan</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab("riwayat")}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 shadow-sm active:scale-95"
                  >
                    <History className="w-4 h-4" />
                    <span>Lihat Detail Usulan & Riwayat</span>
                  </button>
                </div>
              </div>
            ) : verificationStatus === "perbaikan" ? (
              <div className="p-5 bg-rose-50 border border-rose-300 rounded-3xl flex items-start gap-3.5 shadow-xs">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-950 space-y-1">
                  <div className="font-bold text-sm text-rose-950 flex items-center gap-2">
                    <span>Status Data: Perlu Perbaikan dari Lembaga</span>
                    <span className="px-2 py-0.5 bg-rose-200 text-rose-900 rounded-full text-[10px] font-bold">
                      Perlu Koreksi
                    </span>
                  </div>
                  <p className="text-rose-800 leading-relaxed">
                    Pengajuan sebelumnya telah ditolak atau diminta perbaikan oleh Admin verifikator. Silakan periksa <b>Catatan Admin di Tab Riwayat Pengajuan</b>, sesuaikan isian formulir atau polygon di bawah, lalu ajukan kembali.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-3xl flex items-start gap-3 shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950 space-y-1">
                  <div className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                    <span>Status Data: Terverifikasi Valid</span>
                    <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-bold">
                      Resmi
                    </span>
                  </div>
                  <p className="text-emerald-800">
                    Data institusi dan polygon batas lahan Anda telah disahkan. Anda dapat mengajukan pembaruan data kapan saja; saat disimpan, data akan masuk ke antrean verifikasi Admin.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section 1: Keterangan Profil Institusi */}
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-4">
                <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                      <Building className="w-5 h-5 text-emerald-600" />
                      <span>Keterangan & Profil Lembaga</span>
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Perbarui informasi umum dan identitas kelembagaan
                    </p>
                  </div>
                  {isLocked && (
                    <span className="px-2.5 py-1 bg-zinc-100 text-zinc-500 rounded-lg text-xs font-semibold flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Terkunci</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1.5">
                      Nama Institusi / Lembaga *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isLocked}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        isLocked
                          ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                          : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1.5">
                      Nomor Statistik / Data Lembaga (NSP/NPSN/NSM)
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={nomorDataLembaga}
                      onChange={(e) => setNomorDataLembaga(e.target.value)}
                      placeholder="Contoh: 510035070001"
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        isLocked
                          ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                          : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1.5">
                      Tipe Lembaga
                    </label>
                    <select
                      disabled={isLocked}
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        isLocked
                          ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                          : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      }`}
                    >
                      <option value="pesantren">Pesantren</option>
                      <option value="madrasah">Madrasah</option>
                      <option value="sekolah_islam">Sekolah Islam</option>
                      <option value="perguruan_tinggi">Perguruan Tinggi Islam</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1.5">
                      Jenjang Pendidikan
                    </label>
                    <select
                      disabled={isLocked}
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        isLocked
                          ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                          : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      }`}
                    >
                      <option value="dasar">Dasar (MI / SDIT)</option>
                      <option value="menengah">Menengah (MTs / MA / SMAIT)</option>
                      <option value="tinggi">Pendidikan Tinggi</option>
                      <option value="salafiyah">Salafiyah / Tradisional</option>
                      <option value="kombinasi">Kombinasi / Terpadu</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1.5">
                      Status Lembaga
                    </label>
                    <select
                      disabled={isLocked}
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        isLocked
                          ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                          : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      }`}
                    >
                      <option value="swasta">Swasta (Yayasan / Pesantren)</option>
                      <option value="negeri">Negeri (Kemenag)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1.5">
                      Akreditasi Lembaga
                    </label>
                    <select
                      disabled={isLocked}
                      value={accreditation}
                      onChange={(e) => setAccreditation(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        isLocked
                          ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                          : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      }`}
                    >
                      <option value="">-- Pilih Akreditasi --</option>
                      <option value="A">Terakreditasi A (Unggul)</option>
                      <option value="B">Terakreditasi B (Baik Sekali)</option>
                      <option value="C">Terakreditasi C (Baik)</option>
                      <option value="Belum Terakreditasi">Belum Terakreditasi</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-zinc-700 mb-1.5">
                      Alamat Lengkap Lembaga
                    </label>
                    <textarea
                      rows={2}
                      disabled={isLocked}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Jalan, RT/RW, Dusun, Kelurahan/Desa, Kecamatan..."
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        isLocked
                          ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                          : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1.5">
                      Provinsi
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="Contoh: Jawa Timur"
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        isLocked
                          ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                          : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1.5">
                      Kabupaten / Kota
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Contoh: Malang"
                      className={`w-full px-3.5 py-2.5 rounded-xl border ${
                        isLocked
                          ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                          : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      }`}
                    />
                  </div>

                  {/* Titik Pusat Lembaga */}
                  <div className="md:col-span-2 pt-2 border-t border-zinc-100">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-zinc-800">Titik Pusat Lembaga</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mb-3">
                      Koordinat titik tengah lembaga yang tampil sebagai pin marker di peta utama. Berbeda dari polygon batas bidang lahan — titik ini mewakili pusat lokasi lembaga secara umum.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-zinc-700 mb-1.5 text-xs">
                          Latitude (Lintang)
                        </label>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={latitudeStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLatitudeStr(val);
                            const lat = parseFloat(val);
                            const lng = parseFloat(longitudeStr);
                            if (!isNaN(lat) && !isNaN(lng)) {
                              setCoordinates([lat, lng]);
                            }
                          }}
                          placeholder="Contoh: -7.9510777"
                          className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs ${
                            isLocked
                              ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                              : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          }`}
                        />
                        <p className="text-[10px] text-zinc-400 mt-1">Nilai negatif = Lintang Selatan (LS)</p>
                      </div>
                      <div>
                        <label className="block font-semibold text-zinc-700 mb-1.5 text-xs">
                          Longitude (Bujur)
                        </label>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={longitudeStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLongitudeStr(val);
                            const lat = parseFloat(latitudeStr);
                            const lng = parseFloat(val);
                            if (!isNaN(lat) && !isNaN(lng)) {
                              setCoordinates([lat, lng]);
                            }
                          }}
                          placeholder="Contoh: 112.6070169"
                          className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs ${
                            isLocked
                              ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                              : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          }`}
                        />
                        <p className="text-[10px] text-zinc-400 mt-1">Nilai positif = Bujur Timur (BT)</p>
                      </div>
                    </div>
                    {coordinates && (
                      <p className="text-[10px] text-emerald-700 mt-2 font-mono bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        📍 Titik saat ini: {coordinates[0].toFixed(6)}, {coordinates[1].toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Informasi Tanah, Legalitas & Polygon Lahan */}
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-6">
                <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-emerald-600" />
                      <span>DAFTAR POLYGON BIDANG TANAH</span>
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Daftar lokasi bidang tanah (polygon) beserta peta dan titik fasilitas gedung
                    </p>
                  </div>

                  {isLocked ? (
                    <div className="px-3 py-1.5 bg-zinc-100 text-zinc-400 border border-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed">
                      <Lock className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Tambah Polygon Terkunci</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(explicitId ? `/polygon-editor/tambah?id=${explicitId}` : "/polygon-editor/tambah")
                      }
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Polygon Baru</span>
                    </button>
                  )}
                </div>

                {/* List of Polygons Bertumpuk ke Bawah */}
                {polygons.length === 0 ? (
                  <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl space-y-3">
                    <Layers className="w-10 h-10 text-zinc-300 mx-auto" />
                    <p className="text-xs font-semibold text-zinc-600">
                      Belum ada polygon bidang tanah yang terdaftar.
                    </p>
                    <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                      Silakan tambah polygon baru untuk menentukan batas lahan dan titik fasilitas lembaga Anda.
                    </p>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(explicitId ? `/polygon-editor/tambah?id=${explicitId}` : "/polygon-editor/tambah")
                        }
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah Polygon Baru</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {polygons.map((poly, idx) => {
                      const associatedChildPoints = childPoints.filter(
                        (cp) => cp.polygonId === poly.id || cp.polygonName === poly.name
                      );

                      let polyCoords: [number, number] = coordinates || [-7.95156, 112.60742];
                      if (poly.coordinates && poly.coordinates.length > 0) {
                        const lats = poly.coordinates.map((c) => c[1]);
                        const lngs = poly.coordinates.map((c) => c[0]);
                        const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
                        const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
                        if (!isNaN(avgLat) && !isNaN(avgLng)) {
                          polyCoords = [avgLat, avgLng];
                        }
                      }

                      return (
                        <div
                          key={poly.id || idx}
                          className="bg-zinc-50/50 border border-zinc-200 rounded-3xl p-6 space-y-4 shadow-2xs hover:border-emerald-300 transition-all"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-extrabold rounded-md font-mono">
                                  #{idx + 1}
                                </span>
                                <h3 className="text-base font-bold text-zinc-900">{poly.name}</h3>
                              </div>
                              <p className="text-xs text-zinc-500 font-mono mt-1">
                                Luas Area: {poly.area_m2 ? `${poly.area_m2.toLocaleString("id-ID")} m²` : "0 m²"} (
                                {((poly.area_m2 || 0) / 10000).toFixed(2)} Ha)
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold">
                                {associatedChildPoints.length} Titik Fasilitas
                              </span>
                            </div>
                          </div>

                          <div className="rounded-2xl overflow-hidden border border-zinc-200 shadow-inner">
                            <MiniMap
                              coordinates={polyCoords}
                              name={poly.name}
                              type={type}
                              polygons={[poly]}
                              childPoints={associatedChildPoints}
                            />
                          </div>

                          <div className="pt-3 border-t border-zinc-200/80 flex items-center justify-between gap-2 flex-wrap">
                            {(() => {
                              const isPolyPending = pendingPolygonIds.includes(poly.id);
                              // Case 1: This specific polygon has pending polygon changes → read-only
                              if (isPolyPending) {
                                return (
                                  <div className="flex items-center gap-2 flex-wrap justify-end w-full">
                                    <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg flex items-center gap-1.5">
                                      <Lock className="w-3 h-3" />
                                      Bidang ini menunggu verifikasi Admin atas perubahan bentuk polygon
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => router.push(`/polygon-editor/edit/${poly.id}?readonly=1${explicitId ? `&id=${explicitId}` : ""}`)}
                                      className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                                    >
                                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Hanya Lihat</span>
                                    </button>
                                  </div>
                                );
                              }
                              // Case 2: Institution locked (profile/polygon submitted) but this polygon NOT pending → allow child point management
                              if (isLocked && !isPolyPending) {
                                return (
                                  <div className="flex items-center gap-2 flex-wrap justify-between w-full">
                                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Titik fasilitas tetap dapat dikelola
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => router.push(`/polygon-editor/edit/${poly.id}${explicitId ? `?id=${explicitId}` : ""}`)}
                                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                                    >
                                      <MapPin className="w-3.5 h-3.5" />
                                      <span>Kelola Titik Fasilitas</span>
                                    </button>
                                  </div>
                                );
                              }
                              // Case 3: Fully unlocked → full edit
                              return (
                                <div className="flex items-center gap-2 justify-end w-full">
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/polygon-editor/edit/${poly.id}${explicitId ? `?id=${explicitId}` : ""}`)}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                    <span>Edit Polygon & Fasilitas</span>
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}

                    {!isLocked && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(explicitId ? `/polygon-editor/tambah?id=${explicitId}` : "/polygon-editor/tambah")
                          }
                          className="w-full py-3.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-2 border-dashed border-zinc-300 hover:border-emerald-500 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4 text-emerald-600" />
                          <span>+ Tambah Polygon Bidang Lahan Baru</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-Section: Atribut Legalitas & Penilaian Aset */}
                <div className="pt-6 border-t border-zinc-200 space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900">
                    Atribut Legalitas Tanah & Penilaian Aset
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-zinc-700 mb-1.5">
                        Total Luas Tanah Lembaga (m²) *
                      </label>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={landTotalAreaM2}
                        onChange={(e) => setLandTotalAreaM2(e.target.value)}
                        placeholder="Contoh: 15000"
                        className={`w-full px-3.5 py-2.5 rounded-xl border ${
                          isLocked
                            ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                            : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-zinc-700 mb-1.5">
                        Status Sertifikat Tanah
                      </label>
                      <select
                        disabled={isLocked}
                        value={landCertificateStatus}
                        onChange={(e) => setLandCertificateStatus(e.target.value)}
                        className={`w-full px-3.5 py-2.5 rounded-xl border ${
                          isLocked
                            ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                            : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        }`}
                      >
                        <option value="Sertifikat Hak Milik (SHM)">Sertifikat Hak Milik (SHM)</option>
                        <option value="Sertifikat Wakaf">Sertifikat Wakaf</option>
                        <option value="Hak Guna Bangunan (HGB)">Hak Guna Bangunan (HGB)</option>
                        <option value="Girik / Letter C">Girik / Letter C / Petok D</option>
                        <option value="Akta Ikrar Wakaf (AIW)">Akta Ikrar Wakaf (AIW)</option>
                        <option value="Belum Bersertifikat">Belum Bersertifikat / Proses</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-zinc-700 mb-1.5">
                        Nomor Sertifikat / Dokumen Tanah
                      </label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={landCertificateNumber}
                        onChange={(e) => setLandCertificateNumber(e.target.value)}
                        placeholder="Contoh: No. 1234/Desa..."
                        className={`w-full px-3.5 py-2.5 rounded-xl border ${
                          isLocked
                            ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                            : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-zinc-700 mb-1.5">
                        NJOP (Rp / m²)
                      </label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={landNjop}
                        onChange={(e) => setLandNjop(e.target.value)}
                        placeholder="Contoh: 1500000"
                        className={`w-full px-3.5 py-2.5 rounded-xl border ${
                          isLocked
                            ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                            : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-zinc-700 mb-1.5">
                        Harga Pasar Tanah per m² (Rp)
                      </label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={landPricePerM2}
                        onChange={(e) => setLandPricePerM2(e.target.value)}
                        placeholder="Contoh: 2000000"
                        className={`w-full px-3.5 py-2.5 rounded-xl border ${
                          isLocked
                            ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                            : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-zinc-700 mb-1.5">
                        Estimasi Total Nilai Aset Lahan
                      </label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={landEstimatedTotalValue}
                        onChange={(e) => setLandEstimatedTotalValue(e.target.value)}
                        placeholder="Contoh: 30000000000"
                        className={`w-full px-3.5 py-2.5 rounded-xl border ${
                          isLocked
                            ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                            : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        }`}
                      />
                    </div>

                    {/* Peruntukan Lahan Checkboxes */}
                    <div className="md:col-span-3">
                      <label className="block font-semibold text-zinc-700 mb-2">
                        Penggunaan / Peruntukan Lahan Lembaga:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {USE_CATEGORY_OPTIONS.map((opt) => (
                          <label
                            key={opt.id}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
                              isLocked
                                ? "bg-zinc-100 text-zinc-500 border-zinc-200 cursor-not-allowed"
                                : landUseCategories.includes(opt.id)
                                ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium cursor-pointer"
                                : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={landUseCategories.includes(opt.id)}
                              onChange={() => toggleCategory(opt.id)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 disabled:opacity-50"
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block font-semibold text-zinc-700 mb-1.5">
                        Catatan Keterangan Tambahan
                      </label>
                      <textarea
                        rows={3}
                        disabled={isLocked}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Tuliskan keterangan riwayat wakaf, rencana perluasan, atau keterangan lain tentang institusi..."
                        className={`w-full px-3.5 py-2.5 rounded-xl border ${
                          isLocked
                            ? "bg-zinc-100/90 text-zinc-600 border-zinc-200 cursor-not-allowed select-none"
                            : "bg-zinc-50 border-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Bottom Save Action Bar */}
              <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-zinc-300/80 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {isLocked ? (
                  <>
                    <div className="text-xs text-amber-950 flex items-start gap-2.5">
                      <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-sm block text-amber-950">
                          Pengajuan Sedang Ditinjau Admin (Data Terkunci)
                        </span>
                        <span className="text-amber-800">
                          Data tidak dapat diubah hingga Admin selesai memverifikasi dan menyetujui atau menolak pengajuan ini.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab("riwayat")}
                        className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <History className="w-4 h-4" />
                        <span>Lihat Riwayat & Catatan Admin</span>
                      </button>
                      <button
                        type="button"
                        disabled
                        className="px-5 py-2.5 bg-zinc-200 text-zinc-400 rounded-xl text-xs font-bold flex items-center gap-2 cursor-not-allowed shadow-none"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Formulir Terkunci</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-zinc-600">
                      <span className="font-semibold text-zinc-900 block">
                        Siap mengajukan perubahan?
                      </span>
                      <span>
                        Saat tombol ditekan, status institusi otomatis menjadi <b>Pengajuan</b> dan formulir terkunci hingga Admin memverifikasi.
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 shrink-0"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Menyimpan Pengajuan...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Submit Pengajuan Perubahan ke Admin</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: RIWAYAT PENGAJUAN PERUBAHAN & CATATAN ADMIN */}
        {/* ════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "riwayat" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-600" />
                  <span>Daftar Riwayat Pengajuan Perubahan</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Rekapitulasi riwayat usulan pembaruan profil lembaga dan bidang polygon tanah beserta status persetujuan dan catatan dari Admin.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1 bg-zinc-100 text-zinc-700 rounded-xl text-xs font-semibold">
                  Total Pengajuan: {historyBatches.length}
                </span>
              </div>
            </div>

            {historyBatches.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-zinc-200 text-center space-y-3">
                <div className="w-12 h-12 bg-zinc-100 text-zinc-400 rounded-2xl flex items-center justify-center mx-auto">
                  <History className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-zinc-800">Belum Ada Riwayat Pengajuan</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Lembaga Anda belum pernah mengajukan pembaruan data atau polygon. Setiap perubahan yang diajukan akan dicatat di halaman ini secara rinci.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5"
                >
                  <Building className="w-4 h-4" />
                  <span>Buka Formulir Data</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {historyBatches.map((batch: any, bIdx: number) => {
                  const isExpanded = expandedBatches[batch.batchId] !== false; // Default expanded
                  const isPending = batch.status === "pending";
                  const isApproved = batch.status === "approved";
                  const isRejected = batch.status === "rejected";

                  return (
                    <div
                      key={batch.batchId || bIdx}
                      className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs transition-all hover:border-zinc-300"
                    >
                      {/* Batch Header Card */}
                      <div
                        onClick={() => toggleBatchAccordion(batch.batchId)}
                        className="p-5 bg-zinc-50/70 hover:bg-zinc-100/70 cursor-pointer border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2.5 rounded-2xl ${
                              isPending
                                ? "bg-amber-100 text-amber-800"
                                : isApproved
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {isPending ? (
                              <Clock className="w-5 h-5 animate-pulse" />
                            ) : isApproved ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <XCircle className="w-5 h-5" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-zinc-900">
                                Pengajuan #{historyBatches.length - bIdx}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  isPending
                                    ? "bg-amber-200 text-amber-900"
                                    : isApproved
                                    ? "bg-emerald-200 text-emerald-900"
                                    : "bg-rose-200 text-rose-900"
                                }`}
                              >
                                {isPending
                                  ? "Menunggu Verifikasi Admin"
                                  : isApproved
                                  ? "Disetujui oleh Admin"
                                  : "Ditolak / Perlu Perbaikan"}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                                <span>
                                  {batch.createdAt
                                    ? new Date(batch.createdAt).toLocaleString("id-ID", {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      })
                                    : "-"}
                                </span>
                              </span>
                              <span>•</span>
                              <span>Oleh: {batch.submitterName || "Operator Institusi"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-400 font-mono hidden md:inline">
                            ID: {String(batch.batchId).slice(0, 8)}...
                          </span>
                          <button
                            type="button"
                            className="p-1.5 hover:bg-white rounded-lg text-zinc-500 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Batch Body (Collapsible) */}
                      {isExpanded && (
                        <div className="p-6 space-y-5">
                          {/* ── CATATAN DARI ADMIN (REVIEWER NOTES) ────────── */}
                          {isRejected && (
                            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1.5">
                              <div className="flex items-center gap-2 font-bold text-xs text-rose-900">
                                <ShieldCheck className="w-4 h-4 text-rose-600" />
                                <span>Catatan Penolakan dari Admin Verifikator:</span>
                              </div>
                              <p className="text-xs text-rose-800 leading-relaxed font-medium pl-6">
                                "{batch.reviewerNotes || 'Pengajuan ditolak oleh Admin verifikator. Silakan periksa kembali data profil atau batasan polygon lahan Anda.'}"
                              </p>
                              {batch.reviewedAt && (
                                <p className="text-[10px] text-rose-500 pl-6 pt-0.5">
                                  Ditinjau pada: {new Date(batch.reviewedAt).toLocaleString("id-ID")}
                                </p>
                              )}
                            </div>
                          )}

                          {isApproved && (
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1.5">
                              <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>Catatan Verifikasi Admin:</span>
                              </div>
                              <p className="text-xs text-emerald-800 leading-relaxed font-medium pl-6">
                                "{batch.reviewerNotes || 'Seluruh usulan perubahan data dan polygon lahan telah disetujui dan diterapkan ke profil resmi institusi.'}"
                              </p>
                              {batch.reviewedAt && (
                                <p className="text-[10px] text-emerald-600 pl-6 pt-0.5">
                                  Disahkan pada: {new Date(batch.reviewedAt).toLocaleString("id-ID")}
                                </p>
                              )}
                            </div>
                          )}

                          {isPending && (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                              <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                                <span>Status Antrean Verifikasi:</span>
                              </div>
                              <p className="text-xs text-amber-800 leading-relaxed pl-6">
                                Pengajuan ini saat ini berstatus <b>Pending</b> dan sedang dalam antrean verifikasi oleh tim Administrator SIS-LPI. Selama proses ini, data institusi dikunci demi mencegah duplikasi atau konflik data.
                              </p>
                            </div>
                          )}

                          {/* ── KATEGORI 1: PERUBAHAN DATA INSTITUSI ────────── */}
                          {batch.data_institusi && batch.data_institusi.changes && Object.keys(batch.data_institusi.changes).length > 0 && (
                            <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
                              <div className="px-4 py-2.5 bg-zinc-100/80 border-b border-zinc-200 flex items-center justify-between">
                                <span className="font-bold text-xs text-zinc-800 flex items-center gap-1.5 uppercase tracking-wide">
                                  <Building className="w-4 h-4 text-emerald-700" />
                                  <span>1. Perubahan Data Institusi</span>
                                </span>
                                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                                  {Object.keys(batch.data_institusi.changes).length} Atribut Berubah
                                </span>
                              </div>

                              <div className="divide-y divide-zinc-200 text-xs">
                                {Object.entries(batch.data_institusi.changes).map(([k, ch]: any) => {
                                  const beforeStr =
                                    ch.before !== null && ch.before !== undefined && ch.before !== ""
                                      ? String(ch.before)
                                      : "— (Kosong)";
                                  const afterStr =
                                    ch.after !== null && ch.after !== undefined && ch.after !== ""
                                      ? String(ch.after)
                                      : "— (Kosong)";

                                  return (
                                    <div key={k} className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center bg-white">
                                      <span className="font-semibold text-zinc-700">
                                        {ch.label || k}
                                      </span>
                                      <div className="text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                                        <span className="text-[10px] text-zinc-400 block font-normal">Sebelum:</span>
                                        <span className="line-through">{beforeStr}</span>
                                      </div>
                                      <div className="text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 font-semibold">
                                        <span className="text-[10px] text-zinc-400 block font-normal">Usulan Baru:</span>
                                        <span>{afterStr}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ── KATEGORI 2: PERUBAHAN DATA POLYGON ────────── */}
                          {batch.polygon && (
                            <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs space-y-3 p-4 bg-zinc-50/50">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3">
                                <span className="font-bold text-xs text-zinc-800 flex items-center gap-1.5 uppercase tracking-wide">
                                  <Layers className="w-4 h-4 text-emerald-700" />
                                  <span>2. Perubahan Data Polygon Lahan</span>
                                </span>

                                {batch.polygon.diff && (
                                  <div className="flex items-center gap-3 text-xs">
                                    <span className="text-zinc-600 font-medium">
                                      Bidang: <b>{batch.polygon.diff.total_before}</b> ➜ <b>{batch.polygon.diff.total_after}</b>
                                    </span>
                                    <span>•</span>
                                    <span className="text-zinc-600 font-medium">
                                      Total Luas: <b>{batch.polygon.diff.total_area_before?.toLocaleString("id-ID")} m²</b> ➜ <b>{batch.polygon.diff.total_area_after?.toLocaleString("id-ID")} m²</b>
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Added Polygons */}
                              {batch.polygon.diff?.added && batch.polygon.diff.added.length > 0 && (
                                <div className="space-y-2">
                                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                    <Plus className="w-3.5 h-3.5" /> Bidang Ditambahkan ({batch.polygon.diff.added.length})
                                  </span>
                                  <div className="space-y-1.5">
                                    {batch.polygon.diff.added.map((ap: any) => (
                                      <div
                                        key={ap.id}
                                        className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-0.5 bg-blue-600 text-white rounded font-bold text-[10px]">
                                            + Penambahan Bidang
                                          </span>
                                          <span className="font-bold text-emerald-950">{ap.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <div className="text-emerald-800 font-mono text-xs">
                                            {Number(ap.area_m2 || 0).toLocaleString("id-ID")} m² ({ap.points_count || 0} titik)
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPreviewMapModal({
                                                isOpen: true,
                                                institutionName: name || inst?.name || "Institusi",
                                                coordinates: coordinates || [-2.5, 108.0],
                                                previousPolygons: batch.polygon.previousPolygons || [],
                                                newPolygons: batch.polygon.newPolygons || [],
                                                diff: batch.polygon.diff,
                                                focusPolygonId: ap.id,
                                                initialMode: "after",
                                                title: `Pratinjau Bidang Baru: ${ap.name}`,
                                                subtitle: `Bidang baru ditambahkan seluas ${Number(ap.area_m2 || 0).toLocaleString("id-ID")} m² (${ap.points_count || 0} titik vertex koordinat).`,
                                              })
                                            }
                                            className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Pratinjau Bidang</span>
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Modified Polygons */}
                              {batch.polygon.diff?.modified && batch.polygon.diff.modified.length > 0 && (
                                <div className="space-y-2">
                                  <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                                    <Edit3 className="w-3.5 h-3.5" /> Bidang Diubah ({batch.polygon.diff.modified.length})
                                  </span>
                                  <div className="space-y-1.5">
                                    {batch.polygon.diff.modified.map((mp: any) => (
                                      <div
                                        key={mp.id}
                                        className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-0.5 bg-amber-600 text-white rounded font-bold text-[10px]">
                                            ✎ Perubahan Bidang
                                          </span>
                                          <span className="font-bold text-amber-950">{mp.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3 flex-wrap">
                                          <div className="text-amber-900 font-mono text-xs flex items-center gap-1.5">
                                            <span className="line-through text-zinc-400">
                                              {Number(mp.before_area_m2 || 0).toLocaleString("id-ID")} m²
                                            </span>
                                            <span>→</span>
                                            <span className="font-bold text-emerald-700">
                                              {Number(mp.after_area_m2 || 0).toLocaleString("id-ID")} m²
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPreviewMapModal({
                                                isOpen: true,
                                                institutionName: name || inst?.name || "Institusi",
                                                coordinates: coordinates || [-2.5, 108.0],
                                                previousPolygons: batch.polygon.previousPolygons || [],
                                                newPolygons: batch.polygon.newPolygons || [],
                                                diff: batch.polygon.diff,
                                                focusPolygonId: mp.id,
                                                initialMode: "overlay",
                                                title: `Komparasi Sebelum vs Sesudah: ${mp.name}`,
                                                subtitle: `Perbandingan bidang tanah '${mp.name}' (${Number(mp.before_area_m2 || 0).toLocaleString("id-ID")} m² → ${Number(mp.after_area_m2 || 0).toLocaleString("id-ID")} m²). Garis merah putus-putus = bentuk awal, garis hijau/biru solid = usulan baru.`,
                                              })
                                            }
                                            className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                                          >
                                            <GitCompare className="w-3.5 h-3.5" />
                                            <span>Bandingkan Sebelum vs Sesudah</span>
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Deleted Polygons */}
                              {batch.polygon.diff?.deleted && batch.polygon.diff.deleted.length > 0 && (
                                <div className="space-y-2">
                                  <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                                    <Trash2 className="w-3.5 h-3.5" /> Bidang Dihapus ({batch.polygon.diff.deleted.length})
                                  </span>
                                  <div className="space-y-1.5">
                                    {batch.polygon.diff.deleted.map((dp: any) => (
                                      <div
                                        key={dp.id}
                                        className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-0.5 bg-rose-600 text-white rounded font-bold text-[10px]">
                                            - Penghapusan Bidang
                                          </span>
                                          <span className="font-bold text-rose-950 line-through">{dp.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <div className="text-rose-800 font-mono text-xs">
                                            {Number(dp.area_m2 || 0).toLocaleString("id-ID")} m²
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPreviewMapModal({
                                                isOpen: true,
                                                institutionName: name || inst?.name || "Institusi",
                                                coordinates: coordinates || [-2.5, 108.0],
                                                previousPolygons: batch.polygon.previousPolygons || [],
                                                newPolygons: batch.polygon.newPolygons || [],
                                                diff: batch.polygon.diff,
                                                focusPolygonId: dp.id,
                                                initialMode: "before",
                                                title: `Pratinjau Bidang Yang Dihapus: ${dp.name}`,
                                                subtitle: `Bidang tanah ini diajukan untuk dihapus (${Number(dp.area_m2 || 0).toLocaleString("id-ID")} m²).`,
                                              })
                                            }
                                            className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Pratinjau Yang Dihapus</span>
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Bottom Map Preview Trigger */}
                              <div className="pt-3 flex items-center justify-between flex-wrap gap-2 border-t border-zinc-200">
                                <span className="text-[11px] text-zinc-500">
                                  Usulan akhir: <strong>{batch.polygon.newPolygons?.length || 0} bidang</strong> ({Number(batch.polygon.diff?.total_area_after || 0).toLocaleString("id-ID")} m²).
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewMapModal({
                                      isOpen: true,
                                      institutionName: name || inst?.name || "Institusi",
                                      coordinates: coordinates || [-2.5, 108.0],
                                      previousPolygons: batch.polygon.previousPolygons || [],
                                      newPolygons: batch.polygon.newPolygons || [],
                                      diff: batch.polygon.diff,
                                      focusPolygonId: null,
                                      initialMode: "overlay",
                                      title: `Komparasi Spasial Pengajuan: ${name || inst?.name}`,
                                      subtitle: "Overlay perbandingan seluruh bidang tanah sebelum (garis merah putus-putus) dan usulan baru (garis hijau/biru solid).",
                                    })
                                  }
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                                >
                                  <GitCompare className="w-4 h-4" />
                                  <span>Buka Peta Komparasi Sebelum vs Sesudah</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* POLYGON DIFF MAP MODAL */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {previewMapModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full shadow-2xl border border-zinc-200 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  {previewMapModal.title || `Pratinjau Spasial: ${previewMapModal.institutionName}`}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {previewMapModal.subtitle ||
                    "Garis merah putus-putus = bentuk awal (sebelum), Garis hijau/biru = usulan (sesudah)."}
                </p>
              </div>
              <button
                onClick={() => setPreviewMapModal(null)}
                className="p-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-zinc-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Map Canvas with DynamicPolygonDiffMap */}
            <div className="h-[460px] w-full relative">
              <DynamicPolygonDiffMap
                coordinates={previewMapModal.coordinates}
                institutionName={previewMapModal.institutionName}
                previousPolygons={previewMapModal.previousPolygons}
                newPolygons={previewMapModal.newPolygons}
                diff={previewMapModal.diff}
                focusPolygonId={previewMapModal.focusPolygonId}
                initialMode={previewMapModal.initialMode || "overlay"}
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs">
              <span className="text-zinc-500">
                Gunakan tab di pojok kiri atas peta untuk beralih antara Overlay Komparasi, Sebelum Saja, atau Usulan Saja.
              </span>
              <button
                onClick={() => setPreviewMapModal(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={user}
        onUpdated={(updatedUser) => {
          setUser((prev: any) => ({ ...prev, ...updatedUser }));
        }}
      />
    </div>
  );
}

export default function InstitutionEditPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm">Memuat profil institusi...</p>
        </div>
      }
    >
      <InstitutionEditContent />
    </Suspense>
  );
}
