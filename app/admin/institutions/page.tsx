"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Edit3,
  Trash2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
  LogOut,
  ExternalLink,
  MapPin,
  Layers,
  AlertTriangle,
  UserCheck,
  Check,
  X,
  UserPlus,
} from "lucide-react";

export default function AdminInstitutionsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Institution List State
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // verification_status
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [provinces, setProvinces] = useState<string[]>([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInst, setEditingInst] = useState<any>(null);

  // Super Admin Management Modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [newAdminUser, setNewAdminUser] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
  });
  const [adminMsg, setAdminMsg] = useState("");

  // Create Form State
  const [newInst, setNewInst] = useState({
    name: "",
    type: "pesantren",
    level: "menengah",
    status: "swasta",
    address: "",
    province: "",
    city: "",
    latitude: "",
    longitude: "",
    landTotalAreaM2: "",
    landCertificateStatus: "Sertifikat Hak Milik (SHM)",
    initialPassword: "institusi123",
  });

  const [actionMsg, setActionMsg] = useState("");

  // Check auth session
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated || (data.user?.role !== "super_admin" && data.user?.role !== "admin")) {
          router.push("/login");
        } else {
          setCurrentUser(data.user);
        }
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoadingUser(false));
  }, [router]);

  // Load provinces
  useEffect(() => {
    fetch("/api/provinces")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProvinces(data);
      })
      .catch(console.error);
  }, []);

  // Fetch institutions
  const fetchInstitutions = () => {
    setLoadingList(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      q: searchQuery,
      type: typeFilter,
      verification_status: statusFilter,
      province: provinceFilter,
    });

    fetch(`/api/admin/institutions?${params.toString()}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.data) {
          setInstitutions(resData.data);
          setTotal(resData.total);
          setTotalPages(resData.totalPages);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingList(false));
  };

  useEffect(() => {
    if (currentUser) {
      fetchInstitutions();
    }
  }, [currentUser, page, typeFilter, statusFilter, provinceFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInstitutions();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Quick verification status update
  const handleSetVerificationStatus = async (
    instId: string,
    newStatus: "valid" | "tidak_valid" | "pengajuan"
  ) => {
    try {
      const res = await fetch(`/api/admin/institutions/${instId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setActionMsg(`Status institusi ${instId} berhasil diubah menjadi "${newStatus}"`);
        setInstitutions((prev) =>
          prev.map((item) =>
            item.id === instId ? { ...item, verificationStatus: newStatus } : item
          )
        );
        setTimeout(() => setActionMsg(""), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete institution
  const handleDeleteInstitution = async (instId: string, name: string) => {
    if (!confirm(`Hapus institusi "${name}" beserta akun loginnya?`)) return;
    try {
      const res = await fetch(`/api/admin/institutions/${instId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setActionMsg(`Institusi "${name}" berhasil dihapus.`);
        fetchInstitutions();
        setTimeout(() => setActionMsg(""), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create institution
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newInst),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat institusi");

      setShowCreateModal(false);
      setActionMsg(
        `Institusi baru berhasil dibuat (ID: ${data.institutionId}, Password: ${data.defaultPassword})`
      );
      fetchInstitutions();
      setTimeout(() => setActionMsg(""), 6000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Open edit modal
  const openEditModal = (inst: any) => {
    setEditingInst({ ...inst });
    setShowEditModal(true);
  };

  // Save edit institution
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;

    try {
      const res = await fetch(`/api/admin/institutions/${editingInst.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingInst),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan perubahan");

      setShowEditModal(false);
      setActionMsg(`Data institusi "${editingInst.name}" berhasil diperbarui.`);
      fetchInstitutions();
      setTimeout(() => setActionMsg(""), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Load admins list for Super Admin
  const loadAdmins = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.data) setAdminsList(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAdminUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah admin");

      setAdminMsg("Admin baru berhasil ditambahkan!");
      setNewAdminUser({ username: "", password: "", name: "", email: "" });
      loadAdmins();
    } catch (err: any) {
      setAdminMsg("Error: " + err.message);
    }
  };

  const handleDeleteAdmin = async (adminId: number, adminName: string) => {
    if (!confirm(`Hapus Admin "${adminName}"?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${adminId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAdminMsg(`Admin "${adminName}" berhasil dihapus.`);
        loadAdmins();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm">Memeriksa sesi otentikasi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 font-sans pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-900 transition-colors"
            title="Ke Peta GIS"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-sm">
              SIS
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <span>Panel Admin — Kelola Data Institusi</span>
                {currentUser?.role === "super_admin" ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                    Super Admin
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 font-semibold border border-blue-200">
                    Admin
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-zinc-500">
                CRUD Data Institusi, Verifikasi Validitas, dan Manajemen Polygon
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/admin")}
            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Pengajuan Edit</span>
          </button>

          {currentUser?.role === "super_admin" && (
            <button
              onClick={() => {
                setShowAdminModal(true);
                loadAdmins();
              }}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Kelola Admin</span>
            </button>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Tambah Institusi</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-1.5 hover:bg-red-50 text-zinc-500 hover:text-red-600 rounded-lg transition-colors ml-1"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {actionMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-medium flex items-center justify-between shadow-xs">
            <span>{actionMsg}</span>
            <button onClick={() => setActionMsg("")} className="text-emerald-600 hover:text-emerald-900">
              ✕
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px] relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama institusi, ID, atau kota..."
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Status Verifikasi filter tabs */}
              <div className="flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200">
                <button
                  onClick={() => {
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    statusFilter === "all" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600"
                  }`}
                >
                  Semua Status
                </button>
                <button
                  onClick={() => {
                    setStatusFilter("pengajuan");
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    statusFilter === "pengajuan"
                      ? "bg-amber-500 text-white shadow-xs font-semibold"
                      : "text-amber-700 hover:bg-amber-50"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pengajuan</span>
                </button>
                <button
                  onClick={() => {
                    setStatusFilter("valid");
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    statusFilter === "valid"
                      ? "bg-emerald-600 text-white shadow-xs font-semibold"
                      : "text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Valid</span>
                </button>
                <button
                  onClick={() => {
                    setStatusFilter("tidak_valid");
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    statusFilter === "tidak_valid"
                      ? "bg-red-600 text-white shadow-xs font-semibold"
                      : "text-red-700 hover:bg-red-50"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Tidak Valid</span>
                </button>
              </div>

              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-700 focus:outline-none"
              >
                <option value="all">Semua Tipe</option>
                <option value="pesantren">Pesantren</option>
                <option value="madrasah">Madrasah</option>
                <option value="universitas_islam">PTKI / Universitas</option>
              </select>

              {/* Province filter */}
              <select
                value={provinceFilter}
                onChange={(e) => {
                  setProvinceFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-700 focus:outline-none max-w-[180px]"
              >
                <option value="all">Semua Provinsi</option>
                {provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
            <span>
              Menampilkan {institutions.length} dari total <b>{total.toLocaleString("id-ID")}</b> institusi
            </span>
            <span>Halaman {page} dari {totalPages}</span>
          </div>
        </div>

        {/* Table of Institutions */}
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
          {loadingList ? (
            <div className="p-16 flex flex-col items-center justify-center text-zinc-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs">Memuat data institusi...</span>
            </div>
          ) : institutions.length === 0 ? (
            <div className="p-16 text-center text-zinc-400 text-xs">
              Tidak ada data institusi yang cocok dengan filter pencarian.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-zinc-200 text-zinc-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">ID & Nama Institusi</th>
                    <th className="py-3 px-4">Tipe & Wilayah</th>
                    <th className="py-3 px-4">Data Lahan</th>
                    <th className="py-3 px-4">Polygon</th>
                    <th className="py-3 px-4">Status Data</th>
                    <th className="py-3 px-4 text-right">Aksi Manajemen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {institutions.map((inst) => {
                    const isPending = inst.verificationStatus === "pengajuan";
                    const isValid = inst.verificationStatus === "valid";
                    const isInvalid = inst.verificationStatus === "tidak_valid";

                    return (
                      <tr
                        key={inst.id}
                        className={`hover:bg-zinc-50/80 transition-colors ${
                          isPending ? "bg-amber-50/30" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                            <span>{inst.name}</span>
                          </div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                            <span>ID: <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-600">{inst.id}</code></span>
                            {inst.address && (
                              <span className="truncate max-w-[200px]" title={inst.address}>
                                {inst.address}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              inst.type === "pesantren"
                                ? "bg-blue-50 text-blue-700"
                                : inst.type === "madrasah"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {inst.type}
                          </span>
                          <div className="text-zinc-500 text-[11px] mt-0.5">
                            {inst.city ? `${inst.city}, ` : ""}
                            {inst.province || "Indonesia"}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-zinc-600">
                          <div>
                            {inst.landTotalAreaM2 ? (
                              <span className="font-medium">
                                {Number(inst.landTotalAreaM2).toLocaleString("id-ID")} m²
                              </span>
                            ) : (
                              <span className="text-zinc-400 italic">Belum ada luas</span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            {inst.landCertificateStatus || "Status SHM -"}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {inst.hasPolygon ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                              <Layers className="w-3 h-3 text-emerald-600" />
                              <span>Polygon Ada</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">
                              Titik Saja
                            </span>
                          )}
                        </td>

                        {/* Status Verifikasi */}
                        <td className="py-3.5 px-4">
                          {isPending && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px] animate-pulse border border-amber-300">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pengajuan</span>
                            </div>
                          )}
                          {isValid && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px] border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Valid</span>
                            </div>
                          )}
                          {isInvalid && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-semibold text-[11px] border border-red-200">
                              <XCircle className="w-3.5 h-3.5 text-red-600" />
                              <span>Tidak Valid</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                          {/* One-click toggle valid / invalid */}
                          {inst.verificationStatus !== "valid" && (
                            <button
                              type="button"
                              onClick={() => handleSetVerificationStatus(inst.id, "valid")}
                              className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                              title="Setujui & Tandai Valid"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Valid</span>
                            </button>
                          )}

                          {inst.verificationStatus !== "tidak_valid" && (
                            <button
                              type="button"
                              onClick={() => handleSetVerificationStatus(inst.id, "tidak_valid")}
                              className="p-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                              title="Tandai Tidak Valid"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Tolak</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openEditModal(inst)}
                            className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg"
                            title="Edit Data Institusi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => router.push(`/institusi/edit?id=${inst.id}`)}
                            className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg"
                            title="Buka Laman Edit Polygon & Profil Institusi Ini"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteInstitution(inst.id, inst.name)}
                            className="p-1.5 hover:bg-red-50 text-zinc-400 hover:text-red-600 rounded-lg"
                            title="Hapus Institusi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="p-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-600">
            <div>
              Halaman <b>{page}</b> dari <b>{totalPages}</b> ({total.toLocaleString("id-ID")} total)
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Tambah Institusi Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-zinc-900">
                + Tambah Institusi Baru & Buat Akun Login
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Nama Institusi / Lembaga *
                </label>
                <input
                  type="text"
                  required
                  value={newInst.name}
                  onChange={(e) => setNewInst({ ...newInst, name: e.target.value })}
                  placeholder="Contoh: Pondok Pesantren Al-Hikmah"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Tipe Lembaga</label>
                  <select
                    value={newInst.type}
                    onChange={(e) => setNewInst({ ...newInst, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  >
                    <option value="pesantren">Pesantren</option>
                    <option value="madrasah">Madrasah</option>
                    <option value="universitas_islam">Universitas Islam / PTKI</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Status Lembaga</label>
                  <select
                    value={newInst.status}
                    onChange={(e) => setNewInst({ ...newInst, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  >
                    <option value="swasta">Swasta</option>
                    <option value="negeri">Negeri</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Provinsi</label>
                  <select
                    value={newInst.province}
                    onChange={(e) => setNewInst({ ...newInst, province: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
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
                  <label className="block font-semibold text-zinc-700 mb-1">Kota / Kabupaten</label>
                  <input
                    type="text"
                    value={newInst.city}
                    onChange={(e) => setNewInst({ ...newInst, city: e.target.value })}
                    placeholder="Contoh: Kab. Malang"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  value={newInst.address}
                  onChange={(e) => setNewInst({ ...newInst, address: e.target.value })}
                  placeholder="Jl. Raya..."
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Latitude</label>
                  <input
                    type="text"
                    value={newInst.latitude}
                    onChange={(e) => setNewInst({ ...newInst, latitude: e.target.value })}
                    placeholder="-7.9839"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Longitude</label>
                  <input
                    type="text"
                    value={newInst.longitude}
                    onChange={(e) => setNewInst({ ...newInst, longitude: e.target.value })}
                    placeholder="112.6214"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Luas Tanah (m²)</label>
                  <input
                    type="number"
                    value={newInst.landTotalAreaM2}
                    onChange={(e) => setNewInst({ ...newInst, landTotalAreaM2: e.target.value })}
                    placeholder="cth: 15000"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Password Akun Baru</label>
                  <input
                    type="text"
                    value={newInst.initialPassword}
                    onChange={(e) => setNewInst({ ...newInst, initialPassword: e.target.value })}
                    placeholder="Default: institusi123"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700"
                >
                  Simpan Institusi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Data Institusi */}
      {showEditModal && editingInst && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-zinc-900">
                Edit Data Institusi: {editingInst.name}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Nama Lembaga</label>
                <input
                  type="text"
                  value={editingInst.name || ""}
                  onChange={(e) => setEditingInst({ ...editingInst, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Status Verifikasi</label>
                  <select
                    value={editingInst.verificationStatus || "valid"}
                    onChange={(e) =>
                      setEditingInst({ ...editingInst, verificationStatus: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl font-semibold"
                  >
                    <option value="valid">Valid (Terverifikasi)</option>
                    <option value="pengajuan">Pengajuan (Pending)</option>
                    <option value="tidak_valid">Tidak Valid / Ditolak</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Luas Tanah (m²)</label>
                  <input
                    type="number"
                    value={editingInst.landTotalAreaM2 || ""}
                    onChange={(e) =>
                      setEditingInst({ ...editingInst, landTotalAreaM2: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Alamat</label>
                <textarea
                  rows={2}
                  value={editingInst.address || ""}
                  onChange={(e) => setEditingInst({ ...editingInst, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Provinsi</label>
                  <select
                    value={editingInst.province || ""}
                    onChange={(e) => setEditingInst({ ...editingInst, province: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  >
                    {provinces.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Kota / Kabupaten</label>
                  <input
                    type="text"
                    value={editingInst.city || ""}
                    onChange={(e) => setEditingInst({ ...editingInst, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Catatan / Keterangan</label>
                <textarea
                  rows={2}
                  value={editingInst.notes || ""}
                  onChange={(e) => setEditingInst({ ...editingInst, notes: e.target.value })}
                  placeholder="Keterangan institusi..."
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Reset Kata Sandi User Institusi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Kosongkan bila tidak ingin mengubah kata sandi"
                  value={editingInst.userPassword || ""}
                  onChange={(e) =>
                    setEditingInst({ ...editingInst, userPassword: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-xl text-zinc-700"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Admin (Super Admin only) */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>Manajemen Admin (Super Admin)</span>
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Super user dapat menambah dan mengelola akun Administrator
                </p>
              </div>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            {adminMsg && (
              <div className="p-3 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl">
                {adminMsg}
              </div>
            )}

            {/* Add Admin Form */}
            <form onSubmit={handleCreateAdmin} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
              <span className="font-bold text-zinc-800 block text-xs">
                + Tambah Akun Admin Baru
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Username admin"
                  value={newAdminUser.username}
                  onChange={(e) =>
                    setNewAdminUser({ ...newAdminUser, username: e.target.value })
                  }
                  className="px-3 py-2 bg-white border rounded-xl"
                />
                <input
                  type="password"
                  required
                  placeholder="Kata sandi"
                  value={newAdminUser.password}
                  onChange={(e) =>
                    setNewAdminUser({ ...newAdminUser, password: e.target.value })
                  }
                  className="px-3 py-2 bg-white border rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap admin"
                  value={newAdminUser.name}
                  onChange={(e) =>
                    setNewAdminUser({ ...newAdminUser, name: e.target.value })
                  }
                  className="px-3 py-2 bg-white border rounded-xl"
                />
                <input
                  type="email"
                  placeholder="Email (opsional)"
                  value={newAdminUser.email}
                  onChange={(e) =>
                    setNewAdminUser({ ...newAdminUser, email: e.target.value })
                  }
                  className="px-3 py-2 bg-white border rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl"
              >
                Simpan Admin Baru
              </button>
            </form>

            {/* List Admins */}
            <div className="space-y-2">
              <span className="font-bold text-zinc-800 block text-xs">
                Daftar Administrator Terdaftar ({adminsList.length})
              </span>
              <div className="divide-y border rounded-2xl overflow-hidden bg-white">
                {adminsList.map((adm) => (
                  <div
                    key={adm.id}
                    className="p-3 flex items-center justify-between hover:bg-zinc-50"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900 flex items-center gap-2">
                        <span>{adm.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            adm.role === "super_admin"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {adm.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Username: <code>{adm.username}</code> {adm.email ? `• ${adm.email}` : ""}
                      </div>
                    </div>

                    {adm.role !== "super_admin" && (
                      <button
                        onClick={() => handleDeleteAdmin(adm.id, adm.name)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        title="Hapus Admin"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
