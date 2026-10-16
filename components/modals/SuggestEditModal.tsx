"use client";

import { useState } from "react";
import { X, Send, CheckCircle2, AlertCircle, PlusCircle, Edit3 } from "lucide-react";

interface SuggestEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetInstitution: any | null;
  provinces: string[];
}

export default function SuggestEditModal({
  isOpen,
  onClose,
  targetInstitution,
  provinces,
}: SuggestEditModalProps) {
  const isEditing = Boolean(targetInstitution);

  // Form states for Suggest Edit
  const [fieldName, setFieldName] = useState("address");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterRole, setSubmitterRole] = useState("Pengurus Lembaga");
  const [submitterEmail, setSubmitterEmail] = useState("");

  // Form states for New Institution
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("pesantren");
  const [newLevel, setNewLevel] = useState("menengah");
  const [newStatus, setNewStatus] = useState("swasta");
  const [newAddress, setNewAddress] = useState("");
  const [newProvince, setNewProvince] = useState(provinces[0] || "Jawa Timur");
  const [newCity, setNewCity] = useState("");
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  const [newArea, setNewArea] = useState("");

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      let payload: any = {};

      if (isEditing) {
        payload = {
          action_type: "update",
          institution_id: targetInstitution.id,
          field_name: fieldName,
          current_value: String(targetInstitution[fieldName] || ""),
          suggested_value: suggestedValue,
          submitter_name: submitterName,
          submitter_role: submitterRole,
          submitter_email: submitterEmail,
        };
      } else {
        const coords =
          newLat && newLng ? [parseFloat(newLat), parseFloat(newLng)] : null;
        payload = {
          action_type: "create",
          field_name: "institution_creation",
          submitter_name: submitterName,
          submitter_role: submitterRole,
          submitter_email: submitterEmail,
          suggested_payload: {
            name: newName,
            type: newType,
            level: newLevel,
            status: newStatus,
            address: newAddress,
            province: newProvince,
            city: newCity,
            coordinates: coords,
            land_total_area_m2: newArea ? parseFloat(newArea) : null,
          },
        };
      }

      const res = await fetch("/api/suggest-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal mengirim usulan");
      }

      setSuccessMsg(
        "Usulan berhasil dikirim! Tim verifikator akan meninjau data Anda."
      );
      setTimeout(() => {
        onClose();
        setSuccessMsg("");
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-600 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              {isEditing ? <Edit3 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                {isEditing ? "Usulkan Perbaikan Data" : "Pendaftaran Lembaga Baru"}
              </h2>
              <p className="text-xs text-zinc-500">
                {isEditing
                  ? `Mengoreksi data untuk: ${targetInstitution?.name}`
                  : "Tambahkan lembaga pendidikan Islam yang belum terdata"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isEditing ? (
            <>
              {/* Field to edit */}
              <div>
                <label className="block text-zinc-600 font-semibold mb-1">
                  Bagian yang Ingin Diperbaiki
                </label>
                <select
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                >
                  <option value="name">Nama Lembaga</option>
                  <option value="address">Alamat Jalan</option>
                  <option value="city">Kabupaten / Kota</option>
                  <option value="province">Provinsi</option>
                  <option value="accreditation">Akreditasi</option>
                  <option value="coordinates">Koordinat (Latitude, Longitude)</option>
                  <option value="land_total_area_m2">Total Luas Tanah (m²)</option>
                  <option value="land_certificate_number">Nomor Sertifikat Tanah</option>
                  <option value="notes">Catatan Tambahan</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-600 font-semibold mb-1">
                  Nilai Saat Ini
                </label>
                <input
                  type="text"
                  disabled
                  value={String(targetInstitution[fieldName] || "—")}
                  className="w-full px-3 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-zinc-600 font-semibold mb-1">
                  Nilai yang Diusulkan *
                </label>
                <textarea
                  required
                  rows={3}
                  value={suggestedValue}
                  onChange={(e) => setSuggestedValue(e.target.value)}
                  placeholder="Masukkan data yang benar..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </>
          ) : (
            <>
              {/* New Institution Fields */}
              <div>
                <label className="block text-zinc-600 font-semibold mb-1">
                  Nama Lembaga *
                </label>
                <input
                  required
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Pondok Pesantren Al-Hikmah"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-zinc-600 font-semibold mb-1">
                    Tipe
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                  >
                    <option value="pesantren">Pesantren</option>
                    <option value="madrasah">Madrasah</option>
                    <option value="universitas_islam">Perguruan Tinggi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-600 font-semibold mb-1">
                    Jenjang
                  </label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                  >
                    <option value="dasar">Dasar</option>
                    <option value="menengah">Menengah</option>
                    <option value="atas">Atas</option>
                    <option value="tinggi">Tinggi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-600 font-semibold mb-1">
                    Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                  >
                    <option value="swasta">Swasta</option>
                    <option value="negeri">Negeri</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-600 font-semibold mb-1">
                    Provinsi *
                  </label>
                  <select
                    value={newProvince}
                    onChange={(e) => setNewProvince(e.target.value)}
                    className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                  >
                    {provinces.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-600 font-semibold mb-1">
                    Kota / Kabupaten *
                  </label>
                  <input
                    required
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="Contoh: Malang"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 font-semibold mb-1">
                  Alamat Lengkap
                </label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Jl. Raya No. XX, Desa, Kecamatan..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-zinc-600 font-semibold mb-1">
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                    placeholder="-7.9839"
                    className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-semibold mb-1">
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={newLng}
                    onChange={(e) => setNewLng(e.target.value)}
                    placeholder="112.6214"
                    className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-semibold mb-1">
                    Luas (m²)
                  </label>
                  <input
                    type="number"
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    placeholder="5000"
                    className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                  />
                </div>
              </div>
            </>
          )}

          {/* Submitter Info */}
          <div className="pt-3 border-t border-zinc-100 space-y-3">
            <span className="font-bold text-zinc-800 block text-[11px]">
              Identitas Pengusul
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-zinc-500 font-medium mb-1">
                  Nama Anda *
                </label>
                <input
                  required
                  type="text"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="Nama Lengkap"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                />
              </div>
              <div>
                <label className="block text-zinc-500 font-medium mb-1">
                  Peran / Hubungan
                </label>
                <select
                  value={submitterRole}
                  onChange={(e) => setSubmitterRole(e.target.value)}
                  className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
                >
                  <option value="Pengurus Lembaga">Pengurus Lembaga</option>
                  <option value="Alumni / Santri">Alumni / Santri</option>
                  <option value="Warga Sekitar">Warga Sekitar</option>
                  <option value="Relawan GIS">Relawan GIS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-zinc-500 font-medium mb-1">
                Email / Kontak Konfirmasi *
              </label>
              <input
                required
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-800"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-zinc-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-xl font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold shadow-md shadow-emerald-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? "Mengirim..." : "Kirim Usulan"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
