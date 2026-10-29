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
} from "lucide-react";
import { normalizePolygons, InstitutionPolygon, ChildPointItem } from "@/lib/geometry";

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
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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
  const [polygons, setPolygons] = useState<InstitutionPolygon[]>([]);
  const [childPoints, setChildPoints] = useState<ChildPointItem[]>([]);
  const [polygonGeometry, setPolygonGeometry] = useState<any>(null);
  const [parcels, setParcels] = useState<any[]>([]);
  const [verificationStatus, setVerificationStatus] = useState("valid");

  // Interactive Child Point Picking on Map
  const [isPickingChildPoint, setIsPickingChildPoint] = useState(false);
  const [pickedChildCoords, setPickedChildCoords] = useState<{
    lat: number;
    lng: number;
    polygonId?: string;
    polygonName?: string;
  } | null>(null);

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

        setVerificationStatus(item.verificationStatus || "valid");

        if (item.latitude && item.longitude) {
          setCoordinates([item.latitude, item.longitude]);
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
  }, [explicitId, router]);

  const handlePolygonsChange = (
    newPolygons: InstitutionPolygon[],
    totalAreaM2: number
  ) => {
    setPolygons(newPolygons);
    setPolygonGeometry(newPolygons);
    if (totalAreaM2 > 0) {
      setLandTotalAreaM2(totalAreaM2);
    }
  };

  const handleCoordinatesChange = (newCoords: [number, number]) => {
    setCoordinates(newCoords);
  };

  const toggleCategory = (catId: string) => {
    setLandUseCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      latitude: coordinates ? coordinates[0] : null,
      longitude: coordinates ? coordinates[1] : null,
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
      setSuccessMsg(
        "Perubahan keterangan dan polygon berhasil disimpan! Status institusi kini 'Pengajuan' dan sedang menunggu verifikasi serta persetujuan Admin."
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
        <p className="text-sm">Memuat profil dan data spasial institusi...</p>
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
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 shadow-xs">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-xs text-amber-900 space-y-1">
              <div className="font-bold text-sm text-amber-950 flex items-center gap-2">
                <span>Status Data: Pengajuan Perubahan (Menunggu Verifikasi Admin)</span>
                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[10px] font-semibold">
                  Dalam Peninjauan
                </span>
              </div>
              <p>
                Perubahan data keterangan dan polygon tanah yang Anda kirimkan saat ini berstatus <b>Pengajuan</b>. Admin sedang meninjau dan akan memberikan status <b>Valid</b> setelah diverifikasi.
              </p>
            </div>
          </div>
        )}

        {verificationStatus === "valid" && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-start gap-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 space-y-1">
              <div className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                <span>Status Data: Terverifikasi Valid oleh Admin</span>
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-semibold">
                  Valid
                </span>
              </div>
              <p>
                Data profil dan aset tanah institusi Anda telah terverifikasi valid oleh Admin SIS-LPI. Anda tetap dapat melakukan perubahan atau memperbarui polygon kapan saja; setiap pembaruan akan diajukan kembali ke Admin untuk diverifikasi.
              </p>
            </div>
          </div>
        )}

        {verificationStatus === "tidak_valid" && (
          <div className="p-4 bg-red-50 border border-red-300 rounded-2xl flex items-start gap-3 shadow-xs">
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-900 space-y-1">
              <div className="font-bold text-sm text-red-950 flex items-center gap-2">
                <span>Status Data: Belum Valid / Perlu Perbaikan</span>
                <span className="px-2 py-0.5 bg-red-200 text-red-900 rounded-full text-[10px] font-semibold">
                  Perlu Koreksi
                </span>
              </div>
              <p>
                Pengajuan sebelumnya ditandai belum valid oleh Admin. Silakan periksa kembali kelengkapan keterangan profil lembaga, batas polygon tanah, dan ajukan kembali dengan menekan tombol simpan di bawah.
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Nama Institusi / Lembaga *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Nomor Statistik / Data Lembaga (NSP/NPSN/NSM)
                </label>
                <input
                  type="text"
                  value={nomorDataLembaga}
                  onChange={(e) => setNomorDataLembaga(e.target.value)}
                  placeholder="Contoh: 510035070001"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Tipe Lembaga
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="pesantren">Pesantren</option>
                  <option value="madrasah">Madrasah</option>
                  <option value="universitas_islam">Universitas Islam / PTKI</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Jenjang Pendidikan
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="dasar">Dasar (MI / Diniyah Ula)</option>
                  <option value="menengah">Menengah (MTs / MA / Wustha / Ulya)</option>
                  <option value="tinggi">Tinggi (Institut / Universitas / Ma'had Aly)</option>
                  <option value="semua">Semua Jenjang</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Status Kelembagaan
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="swasta">Swasta</option>
                  <option value="negeri">Negeri</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Akreditasi
                </label>
                <input
                  type="text"
                  value={accreditation}
                  onChange={(e) => setAccreditation(e.target.value)}
                  placeholder="Contoh: A (Unggul), Terakreditasi, atau Belum"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Nama jalan, RT/RW, Dusun, Desa/Kelurahan, Kecamatan"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Provinsi
                </label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Pilih Provinsi</option>
                  {provinces.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Kabupaten / Kota
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Contoh: Kab. Jombang"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Titik Pusat Lembaga (Center Point) */}
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-4">
            <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <span>Titik Pusat Koordinat Utama Lembaga</span>
                </h2>
                <p className="text-xs text-zinc-500">
                  Tentukan posisi titik pusat utama lembaga (latitude & longitude)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Latitude (Garis Lintang)
                </label>
                <input
                  type="number"
                  step="any"
                  value={coordinates ? coordinates[0] : ""}
                  onChange={(e) => {
                    const lat = parseFloat(e.target.value);
                    const lng = coordinates ? coordinates[1] : 112.7521;
                    if (!isNaN(lat)) setCoordinates([lat, lng]);
                  }}
                  placeholder="Contoh: -7.951560"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Longitude (Garis Bujur)
                </label>
                <input
                  type="number"
                  step="any"
                  value={coordinates ? coordinates[1] : ""}
                  onChange={(e) => {
                    const lng = parseFloat(e.target.value);
                    const lat = coordinates ? coordinates[0] : -7.2575;
                    if (!isNaN(lng)) setCoordinates([lat, lng]);
                  }}
                  placeholder="Contoh: 112.607420"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                />
              </div>
            </div>

            {coordinates && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Koordinat Terpasang: <code className="font-mono font-bold">{coordinates[0]}, {coordinates[1]}</code>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: DAFTAR POLYGON (Lahan & Peta per Polygon) */}
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-6">
            <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-600" />
                  <span>DAFTAR POLYGON</span>
                </h2>
                <p className="text-xs text-zinc-500">
                  Daftar lokasi bidang tanah (polygon) beserta peta dan titik fasilitas gedung
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push('/polygon-editor/tambah')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Polygon Baru</span>
              </button>
            </div>

            {/* List of Polygons Bertumpuk ke Bawah */}
            {polygons.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl space-y-3">
                <Layers className="w-10 h-10 text-zinc-300 mx-auto" />
                <p className="text-xs font-semibold text-zinc-600">Belum ada polygon bidang tanah yang terdaftar.</p>
                <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                  Silakan tambah polygon baru untuk menentukan batas lahan dan titik fasilitas lembaga Anda.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/polygon-editor/tambah')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Polygon Baru</span>
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {polygons.map((poly, idx) => {
                  const associatedChildPoints = childPoints.filter(
                    (cp) => cp.polygonId === poly.id || cp.polygonName === poly.name
                  );

                  // Polygon center coordinate calculated from bounds or main coordinates fallback
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
                      {/* Polygon Card Header */}
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

                      {/* Map Preview for this Specific Polygon */}
                      <div className="rounded-2xl overflow-hidden border border-zinc-200 shadow-inner">
                        <MiniMap
                          coordinates={polyCoords}
                          name={poly.name}
                          type={type}
                          polygons={[poly]}
                          childPoints={associatedChildPoints}
                        />
                      </div>

                      {/* Action Button: Edit Polygon */}
                      <div className="pt-3 border-t border-zinc-200/80 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => router.push(`/polygon-editor/edit/${poly.id}`)}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit Polygon</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* "+ Tambah polygon baru" button at bottom */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/polygon-editor/tambah')}
                    className="w-full py-3.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-2 border-dashed border-zinc-300 hover:border-emerald-500 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>+ Tambah Polygon Baru</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Keterangan Pertanahan & Legalitas */}
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-4">
            <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <span>Keterangan Tanah & Legalitas Sertifikat</span>
                </h2>
                <p className="text-xs text-zinc-500">
                  Data sertifikasi hak tanah, NJOP, dan peruntukan lahan
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Luas Tanah Total (m²)
                </label>
                <input
                  type="number"
                  value={landTotalAreaM2}
                  onChange={(e) => setLandTotalAreaM2(e.target.value)}
                  placeholder="Auto terisi jika gambar polygon"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Status Sertifikat Tanah
                </label>
                <select
                  value={landCertificateStatus}
                  onChange={(e) => setLandCertificateStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Sertifikat Hak Milik (SHM)">Sertifikat Hak Milik (SHM)</option>
                  <option value="Sertifikat Wakaf">Sertifikat Wakaf</option>
                  <option value="Akta Ikrar Wakaf (AIW)">Akta Ikrar Wakaf (AIW)</option>
                  <option value="Sertifikat Hak Guna Bangunan (HGB)">Hak Guna Bangunan (HGB)</option>
                  <option value="Sertifikat Hak Pakai">Hak Pakai</option>
                  <option value="Girik / Letter C / Petok">Girik / Letter C / Petok</option>
                  <option value="Dalam Proses Sertifikasi">Dalam Proses Sertifikasi</option>
                  <option value="Belum Bersertifikat">Belum Bersertifikat</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Nomor Sertifikat Tanah
                </label>
                <input
                  type="text"
                  value={landCertificateNumber}
                  onChange={(e) => setLandCertificateNumber(e.target.value)}
                  placeholder="Contoh: No. 1234/Desa..."
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  NJOP (Rp / m²)
                </label>
                <input
                  type="text"
                  value={landNjop}
                  onChange={(e) => setLandNjop(e.target.value)}
                  placeholder="Contoh: 1500000"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Harga Pasar Tanah per m² (Rp)
                </label>
                <input
                  type="text"
                  value={landPricePerM2}
                  onChange={(e) => setLandPricePerM2(e.target.value)}
                  placeholder="Contoh: 2000000"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">
                  Estimasi Total Nilai Aset Lahan
                </label>
                <input
                  type="text"
                  value={landEstimatedTotalValue}
                  onChange={(e) => setLandEstimatedTotalValue(e.target.value)}
                  placeholder="Contoh: 30000000000"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                        landUseCategories.includes(opt.id)
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium"
                          : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={landUseCategories.includes(opt.id)}
                        onChange={() => toggleCategory(opt.id)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tuliskan keterangan riwayat wakaf, rencana perluasan, atau keterangan lain tentang institusi..."
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Sticky Bottom Save Action */}
          <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-zinc-300/80 shadow-xl flex items-center justify-between gap-4">
            <div className="text-xs text-zinc-600">
              <span className="font-semibold text-zinc-900 block">
                Siap mengajukan perubahan?
              </span>
              <span>
                Saat disimpan, status institusi otomatis menjadi <b>Pengajuan</b> untuk ditinjau oleh Admin.
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
                  <span>Simpan & Ajukan Perubahan ke Admin</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
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

