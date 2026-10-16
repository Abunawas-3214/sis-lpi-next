# Product Requirements Document (PRD) — SIS-LPI Next
**Sistem Informasi Spasial Lembaga Pendidikan Islam (Next.js Edition)**

---

## 1. Executive Summary
**SIS-LPI Next** adalah platform Web GIS (Sistem Informasi Geografis berbasis web) modern yang dirancang untuk memetakan, mengelola, menganalisis, dan mempublikasikan data spasial serta atribut kelembagaan Lembaga Pendidikan Islam (LPI) di seluruh wilayah Indonesia. Entitas utama mencakup **Pondok Pesantren**, **Madrasah** (Aliyah, Tsanawiyah, Ibtidaiyah), dan **Perguruan Tinggi Keagamaan Islam** (UIN, IAIN, STAIN, PTKIS).

Sistem ini berevolusi dari implementasi monolitik Python/Flask ke arsitektur modern berbasis **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, dan **Drizzle ORM** yang terhubung langsung ke basis data spasial PostgreSQL + PostGIS (35.000+ data lembaga terverifikasi).

---

## 2. Problem Statement & User Pain Points
1. **Penyebaran Data Lembaga yang Luas & Masif**: Terdapat lebih dari 35.000 lembaga pendidikan Islam di Indonesia. Tanpa platform GIS yang responsif dan performan, pemetaan persebaran fasilitas pendidikan dan aset tanah wakaf/hibah menjadi sulit dipantau.
2. **Kebutuhan Verifikasi Legalitas & Aset Tanah**: Sebagian besar lembaga memiliki data bidang tanah (parcels), status sertifikat, peruntukan lahan (pendidikan, asrama, ibadah, ekonomi), serta estimasi NJOP yang membutuhkan visualisasi poligon interaktif.
3. **Keterbatasan Antarmuka Lawas**: Antarmuka berbasis Vanilla HTML/JS sebelumnya memiliki layout yang statis, manajemen state yang rapuh, dan kurang optimal untuk pengalaman mobile/tablet.
4. **Pembaruan Data Partisipatif (Crowdsourcing)**: Masyarakat dan pengelola lembaga membutuhkan saluran untuk mengusulkan koreksi data atau mendaftarkan lembaga baru dengan alur verifikasi admin yang transparan dan aman.

---

## 3. User Personas & Roles

### 3.1 Publik / Calon Santri & Wali Murid
- Menjelajahi peta interaktif berdasarkan lokasi, provinsi, atau radius.
- Memfilter lembaga berdasarkan tipe (Pesantren, Madrasah, Universitas), akreditasi, dan jenjang.
- Melihat profil detail fasilitas, foto, luas lahan, dan status legalitas.

### 3.2 Pengelola Lembaga / Operator Wilayah
- Mengajukan perbaikan data (nama, alamat, koordinat, peruntukan lahan, batas poligon).
- Mengunggah atau menggambar batas bidang tanah (land parcels) dan mengisi informasi sertifikat.

### 3.3 Admin Verifikator (Kemenag / Yayasan / Tim SIS)
- Mengakses panel verifikasi terproteksi password.
- Meninjau pengajuan perubahan (suggested edits) secara individu maupun per-batch.
- Membandingkan data lama vs data usulan (*diff view*).
- Menyetujui (*approve*) atau menolak (*reject*) dengan catatan verifikator.

---

## 4. Key Features & Functional Requirements

### 4.1 Peta GIS Interaktif (Interactive Web Map)
- **Multi-layer Basemaps**: Mendukung OpenStreetMap, Carto Light, Carto Dark, dan Satellite Esri.
- **High-Performance Marker Clustering**: Mampu menangani hingga puluhan ribu marker tanpa lag menggunakan pengelompokan dinamis (clustering).
- **Kategori Marker Visual**:
  - 🟢 **Pondok Pesantren** (Warna aksen: Emerald)
  - 🟡 **Madrasah** (Warna aksen: Amber/Orange)
  - 🔵 **Perguruan Tinggi Islam** (Warna aksen: Indigo/Blue)
- **Visualisasi Poligon Lahan & Sub-Parcel**: Menampilkan batas bidang tanah institusi dan zona peruntukan:
  - Pendidikan, Ibadah, Asrama, Fasilitas Olahraga, Ekonomi/Usaha, Pertanian.
- **Smart Search dengan Alias & Singkatan**:
  - Mengenali singkatan umum seperti `ponpes`, `pp`, `uin`, `iain`, `stain`, `man`, `mts`, `mi`.

### 4.2 Multi-Dimensional Filter Sidebar
- Filter berdasarkan Provinsi (dropdown dinamis dengan hitungan jumlah).
- Filter Tipe Lembaga (Pesantren, Madrasah, Universitas Islam).
- Filter Status Operasional (Negeri, Swasta).
- Filter Jenjang Pendidikan (Dasar, Menengah, Atas, Tinggi).
- Filter Status Akreditasi (Terakreditasi A/B/C, Belum Terakreditasi).
- Toggle visualisasi layer batas tanah (Poligon).

### 4.3 Kartu & Panel Statistik Agregat (Real-time Analytics)
- Total lembaga terdata secara nasional dan terfilter.
- Komposisi per tipe lembaga (Pie / Bar representation).
- 10 Provinsi dengan konsentrasi lembaga tertinggi.
- Metrik presisi geocoding (Exact GPS, Geocoded, City-level).

### 4.4 Halaman & Drawer Detail Lembaga
- Rincian identitas: Nama, Nomor Data Lembaga (NDL/NPSN), Tipe, Jenjang, Akreditasi.
- Alamat lengkap, kontak, koordinat geografis.
- Informasi Lahan & Aset:
  - Luas total ($m^2$), status sertifikat & nomor sertifikat.
  - Nilai NJOP, harga per $m^2$, dan estimasi total valuasi aset.
  - Daftar zonasi penggunaan lahan (Pendidikan, Asrama, Ibadah, dll.).
- Mini-map interaktif yang langsung memfokuskan lokasi lembaga dan poligon tanah.

### 4.5 Alur Usulan Perubahan Data (Crowdsourcing)
- Modal pengusulan data yang intuitif dari halaman detail maupun sidebar.
- Mendukung mode:
  1. **Koreksi Data Atribut**: Nama, alamat, akreditasi, data tanah.
  2. **Koreksi Spasial**: Titik koordinat dan upload GeoJSON / Poligon koordinat.
  3. **Pendaftaran Lembaga Baru**: Input formulir lengkap instansi baru.
- Sistem batching (`batch_id`) untuk menggabungkan beberapa field yang diubah dalam satu sesi pengusulan.

### 4.6 Panel Admin & Workflow Verifikasi
- Autentikasi sesi admin sederhana dan aman.
- Tab filter status: Pending, Approved, Rejected, All.
- Diff viewer: Menampilkan nilai saat ini (*current value*) berdampingan dengan usulan (*suggested value*).
- Fitur One-Click Batch Approve / Reject.
- Otomatis memperbarui tabel `institutions` dan riwayat `updated_at`.

---

## 5. Non-Functional Requirements
- **Performance**: Endpoint peta `/api/institutions/map` merespons dalam < 300ms dengan payload terkompresi.
- **SEO & Modern Web Vitals**: Pemanfaatan Server Components Next.js untuk metadata institusi.
- **Keamanan**: Proteksi injection via query builder Drizzle ORM bertipe aman (type-safe), validasi request body Zod.
- **Kompatibilitas Database**: Berjalan di atas PostgreSQL dengan ekstensi PostGIS yang telah ada tanpa memerlukan migrasi destruktif.
