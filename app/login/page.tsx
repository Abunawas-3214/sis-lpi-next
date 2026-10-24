"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  User,
  ShieldCheck,
  Building,
  ArrowRight,
  Loader2,
  AlertCircle,
  MapPin,
  Check,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Username dan password wajib diisi");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal masuk");
      }

      // Route based on role
      if (data.user?.role === "super_admin" || data.user?.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/institusi/edit");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setDemoCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-emerald-50/20 to-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-zinc-200/80 p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-emerald-600 rounded-2xl text-white shadow-md shadow-emerald-200 mb-1">
            <Building className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Masuk ke SIS-LPI
          </h1>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            Sistem Informasi Spasial Lembaga Pendidikan Islam (Super Admin, Admin, dan Institusi)
          </p>
        </div>

        {/* Demo Fast Selector */}
        <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-200 text-xs space-y-2">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
            Pilih Role / Akun Demo:
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setDemoCredentials("superadmin", "superadmin123")}
              className={`p-2 rounded-xl border text-center transition-all ${
                username === "superadmin"
                  ? "bg-purple-50 border-purple-300 text-purple-700 font-semibold"
                  : "bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-700"
              }`}
            >
              <div className="text-[11px]">Super Admin</div>
            </button>
            <button
              type="button"
              onClick={() => setDemoCredentials("admin", "admin123")}
              className={`p-2 rounded-xl border text-center transition-all ${
                username === "admin"
                  ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                  : "bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-700"
              }`}
            >
              <div className="text-[11px]">Admin</div>
            </button>
            <button
              type="button"
              onClick={() => setDemoCredentials("00639", "institusi123")}
              className={`p-2 rounded-xl border text-center transition-all ${
                username === "00639"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold"
                  : "bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-700"
              }`}
            >
              <div className="text-[11px]">Institusi</div>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Username / ID Institusi
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cth: superadmin, admin, atau 00639"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-zinc-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-zinc-900"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <span>Masuk Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="hover:text-zinc-900 transition-colors"
          >
            ← Kembali ke Peta GIS
          </button>
          <span className="text-[11px] text-zinc-400">v2.0 SIS-LPI</span>
        </div>
      </div>
    </div>
  );
}
