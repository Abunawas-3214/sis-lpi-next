"use client";

import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Layers,
  Database,
  ShieldCheck,
  Building2,
  Code2,
  Cpu,
  GraduationCap,
  HeartHandshake,
  CheckCircle2,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 font-sans pb-16">
      {/* Top Bar */}
      <header className="sticky top-0 z-400 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Peta GIS</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            SIS
          </div>
          <span className="text-xs font-bold text-zinc-900">SIS-LPI</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pt-10 space-y-10">
        {/* Hero Section */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-zinc-200/80 space-y-4 text-center sm:text-left relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <Layers className="w-3.5 h-3.5" />
            <span>Dokumentasi & Ringkasan Pengembangan</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 tracking-tight leading-tight">
            Sistem Informasi Spasial Lembaga Pendidikan Islam (SIS-LPI)
          </h1>

          <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-2xl">
            Platform Web GIS modern berbasis Next.js dan PostGIS untuk memetakan, menginventarisasi, dan mengelola sebaran geografis serta aset lahan lembaga pendidikan Islam di Indonesia.
          </p>
        </div>

        {/* Latar Belakang & Tujuan */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-zinc-200/80 space-y-6">
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-emerald-600" />
            Latar Belakang & Visi
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Lembaga Pendidikan Islam di Indonesia—yang mencakup <strong>Pondok Pesantren</strong>, <strong>Madrasah</strong> (MI, MTs, MA), dan <strong>Perguruan Tinggi Keagamaan Islam (PTKI)</strong>—merupakan pilar penting pendidikan nasional dengan puluhan ribu titik sebaran dan aset tanah wakaf bernilai tinggi.
          </p>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            SIS-LPI dikembangkan untuk menjawab kebutuhan tata kelola aset spasial yang transparan, akurat, dan terverifikasi secara terpadu, mendukung digitalisasi data pertanahan, peruntukan zona parcel, serta legalitas sertifikat wakaf.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl space-y-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
              <h3 className="text-xs font-bold text-blue-900">Pondok Pesantren</h3>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Pemetaan sebaran ponpes salafiyah & modern beserta aset tanah wakaf asrama dan fasilitas ibadah.
              </p>
            </div>
            <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl space-y-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              <h3 className="text-xs font-bold text-amber-900">Madrasah (MI / MTs / MA)</h3>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Inventarisasi madrasah negeri dan swasta dengan data akreditasi, NPSN/NDL, dan jenjang pendidikan.
              </p>
            </div>
            <div className="p-4 bg-red-50/60 border border-red-100 rounded-2xl space-y-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
              <h3 className="text-xs font-bold text-red-900">Perguruan Tinggi Islam (PTKI)</h3>
              <p className="text-[11px] text-red-700 leading-relaxed">
                UIN, IAIN, STAIN, dan perguruan tinggi swasta beserta zonasi kampus, fakultas, dan fasilitas akademik.
              </p>
            </div>
          </div>
        </div>

        {/* Fitur Utama */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-zinc-200/80 space-y-6">
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            Fitur Utama Aplikasi
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-zinc-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Marker Clustering Dinamis
              </div>
              <p className="text-zinc-600 leading-relaxed text-[11px]">
                Pengelompokan puluhan ribu titik sebaran secara otomatis menjadi bulatan klaster angka hijau saat zoom out, dan memecah menjadi pin individual saat zoom in.
              </p>
            </div>

            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-zinc-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Visualisasi Batas Bidang & Zonasi Sub-Parcel
              </div>
              <p className="text-zinc-600 leading-relaxed text-[11px]">
                Dukungan poligon GeoJSON untuk batas luar bidang tanah serta sub-parcel peruntukan (Pendidikan, Ibadah, Olahraga, Asrama, dll).
              </p>
            </div>

            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-zinc-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Crowdsourced Koreksi Data
              </div>
              <p className="text-zinc-600 leading-relaxed text-[11px]">
                Masyarakat dan pengelola lembaga dapat mengusulkan koreksi data nama, koordinat, legalitas sertifikat, dan luas lahan secara langsung.
              </p>
            </div>

            <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-zinc-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Panel Verifikasi Admin
              </div>
              <p className="text-zinc-600 leading-relaxed text-[11px]">
                Dashboard admin yang aman untuk memvalidasi, menyetujui (Approve), atau menolak (Reject) usulan perubahan data secara real-time.
              </p>
            </div>
          </div>
        </div>

        {/* Stack Teknologi */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-zinc-200/80 space-y-6">
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-600" />
            Arsitektur & Stack Teknologi
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
              <strong className="block text-zinc-900 font-bold">Next.js 16</strong>
              <span className="text-[10px] text-zinc-500">Turbopack & App Router</span>
            </div>
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
              <strong className="block text-zinc-900 font-bold">PostgreSQL / PostGIS</strong>
              <span className="text-[10px] text-zinc-500">Spatial Index GIST</span>
            </div>
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
              <strong className="block text-zinc-900 font-bold">Drizzle ORM</strong>
              <span className="text-[10px] text-zinc-500">Type-Safe SQL Query</span>
            </div>
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
              <strong className="block text-zinc-900 font-bold">Leaflet & Clustering</strong>
              <span className="text-[10px] text-zinc-500">Fast Interactive Map</span>
            </div>
          </div>
        </div>

        {/* Footer Nav */}
        <div className="text-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Peta Spasial</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
