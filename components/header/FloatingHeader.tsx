"use client";

import { useEffect, useState } from "react";
import { BarChart3, Info, LogIn, User, LogOut } from "lucide-react";

interface FloatingHeaderProps {
  onOpenStatsModal: () => void;
}

export default function FloatingHeader({ onOpenStatsModal }: FloatingHeaderProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Cek jika pengguna sudah login
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {}
    setCurrentUser(null);
    window.location.href = "/login";
  };

  const displayName = currentUser
    ? currentUser.role === "super_admin"
      ? "Super Admin"
      : currentUser.role === "admin"
      ? "Admin"
      : currentUser.name
    : "";

  return (
    <header className="fixed top-3 md:top-4 left-1/2 -translate-x-1/2 z-400 w-max max-w-[calc(100vw-2rem)]">
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group bg-white/95 backdrop-blur-xl border border-zinc-200/80 shadow-lg shadow-zinc-900/5 rounded-full px-3.5 sm:px-4 py-1.5 md:py-2 flex items-center gap-2 sm:gap-3 transition-all duration-300 ease-out hover:shadow-xl hover:border-zinc-300"
      >
        {/* 1. Logo Aplikasi: Badge SIS + SIS-LPI + Subjudul 2 Baris */}
        <a
          href="/"
          title="Sistem Informasi Spasial Lembaga Pendidikan Islam"
          className="flex items-center gap-2 sm:gap-2.5 shrink-0 group/logo"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-extrabold text-xs shadow-sm shadow-emerald-500/30 tracking-tight group-hover/logo:scale-105 transition-transform">
            SIS
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base md:text-lg text-zinc-900 tracking-tight leading-none">
              SIS-LPI
            </span>
            <div className="h-5 sm:h-6 w-px bg-zinc-200" />
            <div className="text-[9.5px] sm:text-[10px] text-zinc-500 font-semibold leading-tight text-left">
              <span className="block whitespace-nowrap">Sistem Informasi Spasial</span>
              <span className="block whitespace-nowrap">Lembaga Pendidikan Islam</span>
            </div>
          </div>
        </a>

        {/* Divider */}
        <div className="h-5 w-px bg-zinc-200 shrink-0" />

        {/* 2. Deretan Logo Institusi: LPDP, Kemenag, UIN */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Logo 1: LPDP */}
          <div className="flex items-center justify-center">
            <img
              src="/logos/lpdp.png"
              alt="Lembaga Pengelola Dana Pendidikan (LPDP)"
              title="Lembaga Pengelola Dana Pendidikan (LPDP)"
              className="h-6 sm:h-7 w-auto object-contain hover:scale-105 transition-transform drop-shadow-2xs"
            />
          </div>

          {/* Logo 2: Kemenag */}
          <div className="flex items-center justify-center">
            <img
              src="/logos/kemenag.png"
              alt="Kementerian Agama Republik Indonesia"
              title="Kementerian Agama Republik Indonesia"
              className="h-6 sm:h-7 w-auto object-contain hover:scale-105 transition-transform drop-shadow-2xs"
            />
          </div>

          {/* Logo 3: UIN */}
          <div className="flex items-center justify-center">
            <img
              src="/logos/uin.png"
              alt="UIN Maulana Malik Ibrahim Malang"
              title="UIN Maulana Malik Ibrahim Malang"
              className="h-6 sm:h-7 w-auto object-contain hover:scale-105 transition-transform drop-shadow-2xs"
            />
          </div>
        </div>

        {/* 3. Tombol Ekspan Saat Hover: Statistik & Tentang (WAJIB shrink-0 agar tidak terpotong Flexbox) */}
        <div
          className={`flex items-center shrink-0 overflow-hidden transition-all duration-300 ease-out py-0.5 ${
            isHovered
              ? "max-w-[260px] opacity-100 gap-1 sm:gap-1.5 px-1 ml-0.5"
              : "max-w-0 opacity-0 pointer-events-none gap-0 px-0 ml-0"
          }`}
        >
          {/* Tombol Statistik */}
          <button
            onClick={onOpenStatsModal}
            title="Lihat Statistik Spasial Nasional"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-zinc-700 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition-all border border-transparent active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Statistik</span>
          </button>

          {/* Tombol Tentang */}
          <a
            href="/about"
            title="Tentang SIS-LPI & Metodologi GIS"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-zinc-700 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition-all border border-transparent active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tentang</span>
          </a>
        </div>

        {/* 4. Bagian Akun / Login di Ujung Kanan */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pl-0.5">
          {currentUser ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <a
                href={currentUser.role === "institusi" ? "/institusi/edit" : "/admin"}
                title={`Buka Dashboard (${currentUser.name})`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/30 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span className="max-w-[85px] sm:max-w-[105px] truncate">
                  {displayName}
                </span>
              </a>

              <button
                onClick={handleLogout}
                title="Keluar / Logout dari Sistem"
                className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer border border-transparent hover:border-rose-200"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <a
              href="/login"
              title="Masuk ke Sistem (Admin / Institusi)"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/30 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
