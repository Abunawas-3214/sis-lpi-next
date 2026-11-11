"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  LogOut,
  Lock,
  User,
  Mail,
  AlertCircle,
  Loader2,
  Check,
  X,
  ExternalLink,
  MapPin,
  Building2,
  Layers,
  ChevronRight,
  Maximize2,
  Minimize2,
  Calendar,
  Sparkles,
  Eye,
  GitCompare,
} from "lucide-react";
import UserProfileModal from "@/components/profile/UserProfileModal";

// Safe dynamic import for Leaflet map component
const DynamicPolygonDiffMap = dynamic(() => import("@/components/map/PolygonDiffMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] bg-zinc-100 rounded-2xl flex items-center justify-center text-xs text-zinc-400 animate-pulse">
      Memuat Peta Komparasi Polygon...
    </div>
  ),
});

export default function AdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [institutionGroups, setInstitutionGroups] = useState<any[]>([]);
  const [totalEditsCount, setTotalEditsCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loadingEdits, setLoadingEdits] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);

  // Map Modal State
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

  // Check existing session
  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
        if (data.authenticated) {
          fetch("/api/auth/me")
            .then((r) => r.json())
            .then((userData) => {
              if (userData.user) setAdminUser(userData.user);
            })
            .catch(() => {});
        }
      })
      .catch(() => setAuthenticated(false));
  }, []);

  const loadEdits = () => {
    setLoadingEdits(true);
    fetch(`/api/admin/edits?status=${statusFilter}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setInstitutionGroups(data.data);
          setTotalEditsCount(data.total_edits || 0);
        }
      })
      .catch((err) => console.error("Error loading edits:", err))
      .finally(() => setLoadingEdits(false));
  };

  // Fetch edits when authenticated or filter changes
  useEffect(() => {
    if (!authenticated) return;
    loadEdits();
  }, [authenticated, statusFilter]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingLogin(true);
    setLoginError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Password salah");
      setAuthenticated(true);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
  };

  // Approve all changes for an institution
  const handleApproveInstitution = async (instId: string, instName: string) => {
    if (!confirm(`Setujui seluruh usulan perubahan untuk ${instName}?`)) return;
    setProcessingId(instId);
    setActionMsg("");

    try {
      const res = await fetch(`/api/admin/institutions/${instId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyetujui perubahan");

      setActionMsg(`Perubahan untuk ${instName} berhasil disetujui! Status institusi kini Valid.`);
      loadEdits();
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Reject all changes for an institution
  const handleRejectInstitution = async (instId: string, instName: string) => {
    const reason = prompt(
      `Masukkan catatan penolakan untuk ${instName} (opsional):`,
      "Data belum lengkap / perlu penyesuaian batas lahan."
    );
    if (reason === null) return; // User cancelled prompt

    setProcessingId(instId);
    setActionMsg("");

    try {
      const res = await fetch(`/api/admin/institutions/${instId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menolak perubahan");

      setActionMsg(`Usulan untuk ${instName} telah ditolak. Status institusi menjadi Perbaikan.`);
      loadEdits();
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Login Screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-zinc-200/80 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900">
              Admin Verifikator SIS-LPI
            </h1>
            <p className="text-xs text-zinc-500">
              Masukkan kata sandi admin untuk meninjau usulan perubahan data
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-zinc-600 font-semibold mb-1">
                Kata Sandi Admin
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingLogin}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all text-xs"
            >
              {loadingLogin ? "Memverifikasi..." : "Masuk ke Panel"}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              ← Kembali ke Peta GIS
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard Screen
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 font-sans pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Peta GIS</span>
          </button>
          <span className="text-zinc-300">|</span>
          <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Panel Verifikasi Data
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/admin/institutions")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Kelola Data Institusi (CRUD)</span>
          </button>

          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-emerald-50 text-zinc-700 hover:text-emerald-700 rounded-xl text-xs font-medium transition-colors border border-zinc-200"
            title="Kelola Profil & Kata Sandi"
          >
            <User className="w-3.5 h-3.5 text-emerald-600" />
            <span>Profil Akun</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 pt-8 space-y-6">
        {actionMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-medium flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionMsg}</span>
            </div>
            <button onClick={() => setActionMsg("")} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex bg-white p-1 rounded-2xl border border-zinc-200 shadow-xs text-xs font-semibold overflow-x-auto">
            {[
              { id: "pending", label: "Menunggu Review" },
              { id: "approved", label: "Disetujui" },
              { id: "rejected", label: "Ditolak" },
              { id: "all", label: "Semua Riwayat" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                  statusFilter === tab.id
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-zinc-500 flex items-center gap-2">
            <span>
              Total Lembaga: <strong>{institutionGroups.length}</strong>
            </span>
            <span className="text-zinc-300">•</span>
            <span>
              Total Usulan: <strong>{totalEditsCount}</strong>
            </span>
          </div>
        </div>

        {/* List of Groups by Institution */}
        {loadingEdits ? (
          <div className="flex flex-col items-center justify-center h-56 text-zinc-400 gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
            <p className="text-xs font-medium">Memuat usulan perubahan berdasarkan institusi...</p>
          </div>
        ) : institutionGroups.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center text-zinc-400 border border-zinc-200/80 shadow-xs">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-40 text-zinc-400" />
            <h3 className="text-sm font-bold text-zinc-700">Tidak ada usulan pada status ini</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Semua usulan perubahan data dan polygon telah ditinjau atau belum ada pengajuan baru.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {institutionGroups.map((group) => {
              const isPending = group.status === "pending";
              const isProcessing = processingId === group.institution_id;
              const hasDataChanges = group.data_institusi?.has_changes;
              const hasPolygonChanges = group.polygon?.has_changes;

              return (
                <div
                  key={group.institution_id || group.latest_created_at}
                  className="bg-white rounded-3xl shadow-sm border border-zinc-200/80 overflow-hidden transition-all hover:border-zinc-300"
                >
                  {/* Institution Header */}
                  <div className="p-6 bg-zinc-50/60 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-zinc-900">
                          {group.institution_name}
                        </h3>
                        {group.institution_id && (
                          <span className="px-2 py-0.5 bg-zinc-200 text-zinc-700 rounded-md text-[10px] font-mono font-bold">
                            #{group.institution_id}
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            group.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : group.status === "rejected"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {group.status === "pending"
                            ? "Menunggu Verifikasi"
                            : group.status === "approved"
                            ? "Telah Disetujui"
                            : "Ditolak"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          <span>
                            {group.submitter_name} ({group.submitter_role || "Operator Lembaga"})
                          </span>
                        </span>
                        {group.submitter_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{group.submitter_email}</span>
                          </span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          <span>
                            {group.latest_created_at
                              ? new Date(group.latest_created_at).toLocaleString("id-ID")
                              : "-"}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons for Institution */}
                    <div className="flex items-center gap-2 shrink-0">
                      {group.institution_id && (
                        <a
                          href={`/institutions/${group.institution_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 shadow-2xs"
                          title="Lihat profil publik lembaga ini di tab baru"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Lihat Profil</span>
                        </a>
                      )}

                      {isPending && group.institution_id && (
                        <>
                          <button
                            onClick={() =>
                              handleApproveInstitution(group.institution_id, group.institution_name)
                            }
                            disabled={isProcessing}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            <span>{isProcessing ? "Menyetujui..." : "Setujui Semua Perubahan"}</span>
                          </button>

                          <button
                            onClick={() =>
                              handleRejectInstitution(group.institution_id, group.institution_name)
                            }
                            disabled={isProcessing}
                            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            <span>Tolak</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Institution Body: 2 Distinct Categories */}
                  <div className="p-6 space-y-6">
                    {/* ══════════════════════════════════════════════════════════ */}
                    {/* CATEGORY 1: PERUBAHAN DATA INSTITUSI */}
                    {/* ══════════════════════════════════════════════════════════ */}
                    <div className="border border-zinc-200/90 rounded-2xl overflow-hidden shadow-2xs">
                      <div className="px-4 py-3 bg-zinc-100/70 border-b border-zinc-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-emerald-700" />
                          <h4 className="text-xs font-bold text-zinc-900 tracking-wide uppercase">
                            1. Perubahan Data Institusi
                          </h4>
                        </div>
                        {hasDataChanges ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                            {group.data_institusi.changes.length} Atribut Berubah
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400 font-medium">
                            Tidak Ada Perubahan
                          </span>
                        )}
                      </div>

                      <div className="p-4">
                        {hasDataChanges ? (
                          <div className="space-y-2.5">
                            {group.data_institusi.changes.map((ch: any, idx: number) => {
                              const beforeStr =
                                ch.before !== null && ch.before !== undefined && ch.before !== ""
                                  ? String(ch.before)
                                  : "— (Kosong)";
                              const afterStr =
                                ch.after !== null && ch.after !== undefined && ch.after !== ""
                                  ? String(ch.after)
                                  : "— (Kosong)";

                              return (
                                <div
                                  key={idx}
                                  className="p-3 bg-zinc-50 border border-zinc-150 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                                >
                                  <div className="font-bold text-zinc-800 md:w-1/4">
                                    {ch.label || ch.field}
                                  </div>

                                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {/* SEBELUM */}
                                    <div className="p-2 bg-rose-50/70 border border-rose-100 text-rose-800 rounded-lg">
                                      <span className="block text-[10px] font-bold text-rose-600/80 uppercase mb-0.5">
                                        Nilai Sebelumnya (Awal)
                                      </span>
                                      <span className="line-through font-mono font-medium break-all">
                                        {beforeStr}
                                      </span>
                                    </div>

                                    {/* SESUDAH */}
                                    <div className="p-2 bg-emerald-50/80 border border-emerald-150 text-emerald-900 rounded-lg">
                                      <span className="block text-[10px] font-bold text-emerald-700 uppercase mb-0.5">
                                        Nilai Usulan (Sesudah)
                                      </span>
                                      <span className="font-mono font-bold break-all">
                                        {afterStr}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-xs text-zinc-400">
                            Tidak ada perubahan pada data profil / atribut lembaga.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ══════════════════════════════════════════════════════════ */}
                    {/* CATEGORY 2: PERUBAHAN DATA POLYGON */}
                    {/* ══════════════════════════════════════════════════════════ */}
                    <div className="border border-zinc-200/90 rounded-2xl overflow-hidden shadow-2xs">
                      <div className="px-4 py-3 bg-zinc-100/70 border-b border-zinc-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-emerald-700" />
                          <h4 className="text-xs font-bold text-zinc-900 tracking-wide uppercase">
                            2. Perubahan Data Polygon Lahan
                          </h4>
                        </div>
                        {hasPolygonChanges ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md">
                            Ada Perubahan Geometri Spasial
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400 font-medium">
                            Tidak Ada Perubahan
                          </span>
                        )}
                      </div>

                      <div className="p-4 space-y-4">
                        {hasPolygonChanges ? (
                          <>
                            {/* Summary Metrics */}
                            {group.polygon.diff && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                                  <span className="block text-[10px] font-bold text-zinc-500 uppercase">
                                    Total Bidang (Awal)
                                  </span>
                                  <span className="text-base font-bold text-zinc-800">
                                    {group.polygon.diff.total_before} Bidang
                                  </span>
                                </div>
                                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                                  <span className="block text-[10px] font-bold text-emerald-700 uppercase">
                                    Total Bidang (Usulan)
                                  </span>
                                  <span className="text-base font-bold text-emerald-900">
                                    {group.polygon.diff.total_after} Bidang
                                  </span>
                                </div>
                                <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                                  <span className="block text-[10px] font-bold text-zinc-500 uppercase">
                                    Luas Polygon (Awal)
                                  </span>
                                  <span className="text-sm font-bold text-zinc-800">
                                    {Number(group.polygon.diff.total_area_before || 0).toLocaleString("id-ID")} m²
                                  </span>
                                </div>
                                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                                  <span className="block text-[10px] font-bold text-emerald-700 uppercase">
                                    Luas Polygon (Usulan)
                                  </span>
                                  <span className="text-sm font-bold text-emerald-900">
                                    {Number(group.polygon.diff.total_area_after || 0).toLocaleString("id-ID")} m²
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Detailed breakdown: Added, Modified, Deleted with visual preview buttons */}
                            {group.polygon.diff && (
                              <div className="space-y-2.5">
                                {/* Added */}
                                {group.polygon.diff.added?.map((item: any, idx: number) => (
                                  <div
                                    key={`add-${idx}`}
                                    className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 bg-blue-600 text-white rounded font-bold text-[10px]">
                                        + Penambahan Bidang
                                      </span>
                                      <span className="font-bold text-emerald-950">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-emerald-800 font-mono text-xs">
                                        {Number(item.area_m2 || 0).toLocaleString("id-ID")} m² ({item.points_count} titik)
                                      </div>
                                      {group.coordinates && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPreviewMapModal({
                                              isOpen: true,
                                              institutionName: group.institution_name,
                                              coordinates: group.coordinates,
                                              previousPolygons: group.polygon.previous_polygons,
                                              newPolygons: group.polygon.new_polygons,
                                              diff: group.polygon.diff,
                                              focusPolygonId: item.id,
                                              initialMode: "after",
                                              title: `Pratinjau Bidang Baru: ${item.name}`,
                                              subtitle: `Bidang baru ditambahkan seluas ${Number(item.area_m2 || 0).toLocaleString("id-ID")} m² (${item.points_count} titik vertex koordinat).`,
                                            })
                                          }
                                          className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          <span>Pratinjau Bidang</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {/* Modified */}
                                {group.polygon.diff.modified?.map((item: any, idx: number) => (
                                  <div
                                    key={`mod-${idx}`}
                                    className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 bg-amber-600 text-white rounded font-bold text-[10px]">
                                        ✎ Perubahan Bidang
                                      </span>
                                      <span className="font-bold text-amber-950">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <div className="text-amber-900 font-mono text-xs flex items-center gap-1.5">
                                        <span className="line-through text-zinc-400">
                                          {Number(item.before_area_m2 || 0).toLocaleString("id-ID")} m²
                                        </span>
                                        <span>→</span>
                                        <span className="font-bold text-emerald-700">
                                          {Number(item.after_area_m2 || 0).toLocaleString("id-ID")} m²
                                        </span>
                                        <span className="text-[10px] text-zinc-500">
                                          ({item.after_points_count} titik vertex)
                                        </span>
                                      </div>

                                      {group.coordinates && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPreviewMapModal({
                                              isOpen: true,
                                              institutionName: group.institution_name,
                                              coordinates: group.coordinates,
                                              previousPolygons: group.polygon.previous_polygons,
                                              newPolygons: group.polygon.new_polygons,
                                              diff: group.polygon.diff,
                                              focusPolygonId: item.id,
                                              initialMode: "overlay",
                                              title: `Komparasi Sebelum vs Sesudah: ${item.name}`,
                                              subtitle: `Perbandingan bidang tanah '${item.name}' (${Number(item.before_area_m2 || 0).toLocaleString("id-ID")} m² → ${Number(item.after_area_m2 || 0).toLocaleString("id-ID")} m²). Garis merah putus-putus = bentuk awal, garis hijau solid = usulan baru.`,
                                            })
                                          }
                                          className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                                        >
                                          <GitCompare className="w-3.5 h-3.5" />
                                          <span>Bandingkan Sebelum vs Sesudah</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {/* Deleted */}
                                {group.polygon.diff.deleted?.map((item: any, idx: number) => (
                                  <div
                                    key={`del-${idx}`}
                                    className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 bg-rose-600 text-white rounded font-bold text-[10px]">
                                        - Penghapusan Bidang
                                      </span>
                                      <span className="font-bold text-rose-950 line-through">
                                        {item.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-rose-800 font-mono text-xs">
                                        {Number(item.area_m2 || 0).toLocaleString("id-ID")} m² ({item.points_count} titik)
                                      </div>
                                      {group.coordinates && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPreviewMapModal({
                                              isOpen: true,
                                              institutionName: group.institution_name,
                                              coordinates: group.coordinates,
                                              previousPolygons: group.polygon.previous_polygons,
                                              newPolygons: group.polygon.new_polygons,
                                              diff: group.polygon.diff,
                                              focusPolygonId: item.id,
                                              initialMode: "before",
                                              title: `Pratinjau Bidang Yang Dihapus: ${item.name}`,
                                              subtitle: `Bidang tanah ini diajukan untuk dihapus (${Number(item.area_m2 || 0).toLocaleString("id-ID")} m²).`,
                                            })
                                          }
                                          className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          <span>Pratinjau Yang Dihapus</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Polygon List Preview Button */}
                            <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                              <span className="text-[11px] text-zinc-500">
                                Usulan akhir: <strong>{group.polygon.new_polygons?.length || 0} bidang</strong> ({Number(group.polygon.diff?.total_area_after || 0).toLocaleString("id-ID")} m²).
                              </span>

                              {group.coordinates && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewMapModal({
                                      isOpen: true,
                                      institutionName: group.institution_name,
                                      coordinates: group.coordinates,
                                      previousPolygons: group.polygon.previous_polygons,
                                      newPolygons: group.polygon.new_polygons,
                                      diff: group.polygon.diff,
                                      focusPolygonId: null,
                                      initialMode: "overlay",
                                      title: `Komparasi Spasial: ${group.institution_name}`,
                                      subtitle: "Overlay perbandingan seluruh bidang tanah sebelum (garis merah putus-putus) dan usulan baru (garis hijau/biru solid).",
                                    })
                                  }
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                                >
                                  <GitCompare className="w-4 h-4" />
                                  <span>Buka Peta Komparasi Sebelum vs Sesudah</span>
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-4 text-xs text-zinc-400">
                            Tidak ada perubahan pada batas polygon lahan lembaga.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
        currentUser={adminUser}
        onUpdated={(updatedUser) => {
          setAdminUser((prev: any) => ({ ...prev, ...updatedUser }));
        }}
      />
    </div>
  );
}
