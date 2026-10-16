"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [edits, setEdits] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loadingEdits, setLoadingEdits] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Check existing session
  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
      })
      .catch(() => setAuthenticated(false));
  }, []);

  // Fetch edits when authenticated or filter changes
  useEffect(() => {
    if (!authenticated) return;
    setLoadingEdits(true);
    fetch(`/api/admin/edits?status=${statusFilter}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setEdits(data.data);
      })
      .catch((err) => console.error("Error loading edits:", err))
      .finally(() => setLoadingEdits(false));
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

  const handleApproveBatch = async (batchId: string) => {
    if (!confirm("Setujui seluruh perubahan dalam batch ini?")) return;
    try {
      const res = await fetch(`/api/admin/batch/${batchId}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        setActionMsg("Batch berhasil disetujui!");
        setEdits((prev) => prev.filter((b) => b.batch_id !== batchId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectBatch = async (batchId: string) => {
    if (!confirm("Tolak seluruh perubahan dalam batch ini?")) return;
    try {
      const res = await fetch(`/api/admin/batch/${batchId}/reject`, {
        method: "POST",
      });
      if (res.ok) {
        setActionMsg("Batch ditolak.");
        setEdits((prev) => prev.filter((b) => b.batch_id !== batchId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveSingle = async (editId: number) => {
    try {
      const res = await fetch(`/api/admin/edits/${editId}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        setActionMsg("Perubahan disetujui!");
        // Refresh list
        fetch(`/api/admin/edits?status=${statusFilter}`)
          .then((r) => r.json())
          .then((d) => setEdits(d.data || []));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectSingle = async (editId: number) => {
    try {
      const res = await fetch(`/api/admin/edits/${editId}/reject`, {
        method: "POST",
      });
      if (res.ok) {
        setActionMsg("Perubahan ditolak.");
        fetch(`/api/admin/edits?status=${statusFilter}`)
          .then((r) => r.json())
          .then((d) => setEdits(d.data || []));
      }
    } catch (err) {
      console.error(err);
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
      <header className="sticky top-0 z-400 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 px-6 py-3.5 flex items-center justify-between">
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

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-medium transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pt-8 space-y-6">
        {actionMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
            <span>{actionMsg}</span>
            <button onClick={() => setActionMsg("")}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Filters */}
        <div className="flex items-center justify-between">
          <div className="flex bg-white p-1 rounded-2xl border border-zinc-200 shadow-sm text-xs font-semibold">
            {[
              { id: "pending", label: "Menunggu Review" },
              { id: "approved", label: "Disetujui" },
              { id: "rejected", label: "Ditolak" },
              { id: "all", label: "Semua Riwayat" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-4 py-2 rounded-xl transition-all ${
                  statusFilter === tab.id
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-zinc-500">
            Total submission: <strong>{edits.length}</strong>
          </span>
        </div>

        {/* List of Batches / Edits */}
        {loadingEdits ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <p className="text-xs">Memuat daftar usulan...</p>
          </div>
        ) : edits.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center text-zinc-400 border border-zinc-200/80">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-zinc-600">
              Tidak ada data usulan dengan status ini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {edits.map((item) => (
              <div
                key={item.batch_id || item.created_at}
                className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200/80 space-y-4"
              >
                {/* Batch Header */}
                <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">
                      {item.institution_name || "Lembaga Baru"}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {item.submitter_name} ({item.submitter_role || "Warga"})
                      </span>
                      {item.submitter_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {item.submitter_email}
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString("id-ID")
                          : ""}
                      </span>
                    </div>
                  </div>

                  {statusFilter === "pending" && item.batch_id && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveBatch(item.batch_id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Setujui Batch</span>
                      </button>
                      <button
                        onClick={() => handleRejectBatch(item.batch_id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Tolak</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Sub-edits list */}
                <div className="space-y-3">
                  {item.edits?.map((e: any) => (
                    <div
                      key={e.id}
                      className="p-4 bg-zinc-50/70 border border-zinc-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-800 uppercase tracking-wider text-[10px] bg-zinc-200 px-2 py-0.5 rounded">
                            {e.field_name}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              e.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : e.status === "rejected"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {e.status}
                          </span>
                        </div>

                        {/* Diff Before vs After */}
                        <div className="space-y-1">
                          {e.current_value && (
                            <div className="text-rose-700 line-through">
                              Awal: {e.current_value}
                            </div>
                          )}
                          <div className="text-emerald-700 font-semibold">
                            Usulan:{" "}
                            {e.suggested_value ||
                              (e.suggested_payload
                                ? JSON.stringify(e.suggested_payload)
                                : "—")}
                          </div>
                        </div>
                      </div>

                      {e.status === "pending" && !item.batch_id && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleApproveSingle(e.id)}
                            className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                            title="Setujui Perubahan"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRejectSingle(e.id)}
                            className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl"
                            title="Tolak Perubahan"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
