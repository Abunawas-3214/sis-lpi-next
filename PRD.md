# Product Requirements Document (PRD) — SIS-LPI Next
**Sistem Informasi Spasial Lembaga Pendidikan Islam (Next.js Edition)**

---

## 1. Executive Summary & Visi Produk

**SIS-LPI Next** (Sistem Informasi Spasial Lembaga Pendidikan Islam) adalah platform Web GIS (Geographic Information System berbasis web) modern yang dirancang untuk memetakan, mengelola, menganalisis, dan memvalidasi data spasial serta atribut kelembagaan Lembaga Pendidikan Islam di seluruh wilayah Republik Indonesia.

Proyek ini mencakup lebih dari **35.000 lembaga pendidikan Islam terdaftar**, yang terbagi dalam tiga pilar utama:
1. **Pondok Pesantren**: Pesantren Salafiyah, Ashriyah, Mu'adalah, PDF, dsb.
2. **Madrasah**: Raudhatul Athfal (RA), Madrasah Ibtidaiyah (MI), Madrasah Tsanawiyah (MTs), dan Madrasah Aliyah (MA).
3. **Perguruan Tinggi Keagamaan Islam (PTKI)**: Universitas Islam Negeri (UIN), Institut Agama Islam Negeri (IAIN), Sekolah Tinggi Agama Islam Negeri (STAIN), serta Perguruan Tinggi Keagamaan Islam Swasta (PTKIS).

Platform ini dibangun di atas fondasi teknologi mutakhir: **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, **Bun**, dan **Drizzle ORM** yang terintegrasi langsung dengan database spasial **PostgreSQL + PostGIS** (didukung Neon Database).

---

## 2. Masalah Bisnis & Peluang Solusi (Problem Statement & Value Proposition)

### 2.1 Masalah Bisnis
1. **Skala Data Spasial yang Sangat Masif**: Lebih dari 35.000 titik lembaga tersebar dari Sabang sampai Merauke. Sistem lama berbasis HTML/JS statis dan backend Python mengalami kendala performa dan skalabilitas saat merender data secara serentak.
2. **Kebutuhan Tata Kelola Aset & Lahan Wakaf/Hibah**: Sebagian besar lembaga memiliki aset tanah wakaf, hibah, atau hak milik yang belum terpetakan batas poligon lahannya secara akurat. Dibutuhkan visualisasi batas bidang tanah (*land parcels*), informasi legalitas sertifikat, peruntukan lahan, serta estimasi Nilai Jual Objek Pajak (NJOP).
3. **Data Fasilitas Internal Belum Terstruktur**: Lembaga memiliki fasilitas internal kampus (gedung rektorat/asrama/kelas, masjid, laboratorium, perpustakaan) yang seringkali hanya berupa catatan teks tanpa titik koordinat mikro di dalam lingkungan lembaga.
4. **Alur Validasi & Koreksi Data yang Lambat**: Kurangnya portal mandiri bagi pengelola lembaga untuk memperbarui data secara langsung, serta ketiadaan antarmuka verifikasi terpadu bagi administrator pusat untuk meninjau usulan perubahan.

### 2.2 Nilai Solusi (Value Proposition)
- **Visualisasi Spasial Dua Tingkat (Dual-Level GIS)**:
  - *Tingkat Makro*: Peta sebaran nasional dengan marker clustering berkecepatan tinggi (< 300ms respons time).
  - *Tingkat Mikro*: Peta batas poligon lahan institusi dan titik fasilitas internal (*child points*) di dalam batas poligon.
- **Validasi Spasial Ketat (*Spatial Containment Rule*)**: Titik fasilitas internal lembaga secara otomatis divalidasi dengan algoritma point-in-polygon; fasilitas tidak boleh ditempatkan di luar batas lahan polygon lembaga.
- **Siklus Hidup Data Terkelola (*Lifecycle Verification Workflow*)**: Setiap perubahan data mandiri oleh pengelola lembaga masuk ke status verifikasi (`pengajuan` / `perbaikan`) sebelum disahkan menjadi `valid` oleh Admin Verifikator.
- **Crowdsourcing Terbuka & Aman**: Masyarakat umum dapat mengajukan koreksi dengan perbandingan *diff view* otomatis dan batching usulan.

---

## 3. Struktur Pengguna & Peran (User Personas & Role Matrix)

| Peran (Role) | Akses Utama | Tanggung Jawab & Alur Bisnis |
| :--- | :--- | :--- |
| **Publik (Tamu/Santri/Masyarakat)** | `/`, `/institutions/[id]`, `/about` | Menjelajahi peta nasional, memfilter data, melihat profil lembaga, serta mengusulkan koreksi data (`suggested_edits`) tanpa perlu login. |
| **Institusi (Operator Lembaga)** | `/institusi`, `/institusi/edit`, `/institusi/polygon-editor` | Login menggunakan ID Lembaga (misal `01375`). Mengelola profil institusi, menggambar/mengedit poligon batas lahan, dan mengelola titik fasilitas gedung (*child points*). Setiap perubahan data memicu status lembaga menjadi `pengajuan`. |
| **Admin Verifikator (Kemenag/Tim Wilayah)** | `/admin`, `/admin/institutions` | Meninjau antrean usulan crowdsourcing publik, memvalidasi pembaruan profil & polygon lembaga, mengubah status verifikasi lembaga (`valid`, `perbaikan`, `pengajuan`), dan menyetujui/menolak secara batch. |
| **Super Admin** | Seluruh rute `/admin/*` & `/api/admin/*` | Hak akses penuh: manajemen akun pengguna (35.904 akun pengguna lembaga dan akun admin), konfigurasi sistem, dan override seluruh aksi verifikasi. |

---

## 4. Persyaratan Fungsional (Functional Requirements)

### 4.1 Peta GIS Interaktif Publik (Macro Map)
- **Marker Clustering Kinerja Tinggi**: Render dinamis puluhan ribu marker menggunakan Leaflet Markercluster tanpa pembekuan antarmuka (*UI freezing*).
- **Multi-layer Basemaps**:
  - OpenStreetMap (Standard OSM)
  - Carto Light / Positron (Minimalis terang)
  - Carto Dark / Dark Matter (Mode gelap kontras tinggi)
  - Esri World Imagery (Foto satelit resolusi tinggi)
- **Skema Warna Marker Standar**:
  - 🟢 **Pondok Pesantren**: Emerald (`#059669`)
  - 🟡 **Madrasah**: Amber (`#d97706`)
  - 🔵 **Perguruan Tinggi Keagamaan Islam**: Indigo (`#4f46e5`)
- **Pencarian Cerdas (*Smart Search*)**:
  - Mendukung pencarian instan berbasis teks nama, nomor data lembaga, kota/kabupaten.
  - Normalisasi alias dan singkatan umum: `ponpes` / `pp` -> Pondok Pesantren, `uin` / `iain` / `stain` -> Perguruan Tinggi Islam, `man` / `mts` / `mi` -> Madrasah.
- **Panel Filter Multi-Dimensi**:
  - Filter berdasarkan Provinsi (dropdown dengan hitungan agregat real-time).
  - Filter Tipe Lembaga (Pesantren, Madrasah, Universitas).
  - Filter Status Operasional (Negeri, Swasta).
  - Filter Jenjang Pendidikan (Dasar, Menengah, Atas, Tinggi).
  - Filter Status Akreditasi (A, B, C, Belum Terakreditasi).
  - Toggle layer batas polygon tanah.

### 4.2 Portal Lembaga Mandiri (Micro GIS & Profiling)
- **Otentikasi Akun Lembaga**: Login menggunakan username ID Lembaga dan password terenkripsi scrypt.
- **Pengelolaan Profil Lembaga (`/institusi/edit`)**:
  - Pembaruan nama, nomor data lembaga, jenjang, status akreditasi, alamat, kota, dan provinsi.
  - Atribut aset tanah: Luas total ($m^2$), status sertifikat (Hak Milik, Wakaf, HGB, Girik), nomor sertifikat.
  - Aspek ekonomi tanah: Nilai NJOP, harga taksiran pasar per $m^2$, dan tahun valuasi aset.
  - Zonasi peruntukan lahan: Luas area untuk pendidikan, asrama, ibadah, sarana olahraga, pertanian, unit ekonomi, dan peruntukan lainnya.
- **Editor Batas Poligon Lahan Mandiri (`/polygon-editor/tambah` & `/polygon-editor/edit/[id]`)**:
  - **Arsitektur Independen per-Bidang**: Setiap bidang diedit pada kanvas khusus secara terisolasi dengan outline bidang lain sebagai referensi (*ghost layer*).
  - **Toolbar Interaktif 5 Mode**:
    1. *Geser Peta*: Navigasi bebas tanpa mengubah geometri.
    2. *Tambah Titik*: Menambah vertex keliling lahan dengan algoritma anti self-intersection.
    3. *Pindah Titik*: Drag & drop vertex yang sudah ada ke posisi baru secara visual.
    4. *Sisipkan Titik*: Menyisipkan vertex baru di antara dua titik yang sudah terhubung.
    5. *Hapus Titik*: Menghapus vertex tertentu langsung dari peta.
  - **Fitur Perlindungan Data & Keamanan Alur Kerja**:
    - **Tombol Reset Perubahan**: Membatalkan modifikasi geometri dan mengembalikan bidang ke kondisi semula.
    - **Dialog Konfirmasi Perubahan Belum Disimpan (*Unsaved Changes Guard*)**: Muncul saat operator menekan tombol "Kembali" ke `/institusi/edit` atau menutup browser, memberikan opsi *Simpan & Kembali*, *Buang Perubahan & Kembali*, atau *Batal*.
    - **Deteksi Anti-Persilangan Garis (*Self-Intersection Warning & Auto-Fix*)**: Indikator visual instan jika poligon berpotongan berikut tombol perbaikan otomatis.
  - Menghitung luas bidang tanah otomatis ($m^2$) secara geodesik real-time.
- **Pengelolaan Titik Fasilitas Internal Kampus (*Child Points*)**:
  - Menandai titik fasilitas (gedung, masjid, asrama, lab) di atas peta.
  - **Aturan Integritas Spasial**: Titik fasilitas **wajib berada di dalam salah satu poligon tanah** milik institusi. Jika koordinat berada di luar poligon, sistem menolak penyimpanan secara otomatis.
  - Custom Variables dinamis berformat JSON (misal: jumlah lantai, kapasitas jamaah, luas bangunan, tahun renovasi).

### 4.3 Alur Kerja Verifikasi & Admin Panel
- **Status Verifikasi Lembaga**:
  - `valid`: Data telah diverifikasi dan disetujui oleh tim verifikator.
  - `pengajuan`: Terdapat perubahan baru dari pihak lembaga yang menunggu validasi admin.
  - `perbaikan`: Data dikembalikan ke pihak lembaga karena ditemukan ketidaksesuaian/kesalahan berkas.
- **Diff Viewer Usulan Perubahan**:
  - Menampilkan nilai saat ini (*current value*) berdampingan dengan usulan nilai baru (*suggested value*).
  - Mendukung persetujuan per-bidang (*field-level*) maupun secara kelompok (*batch-level*).
- **Manajemen Akun Pengguna**:
  - Administrator dapat melihat daftar 35.904+ akun lembaga, mengubah password, mengaktifkan/menonaktifkan akun.

### 4.4 Usulan Publik (Crowdsourced Suggested Edits)
- Form pengusulan terbuka dari publik untuk melaporkan koreksi data koordinat, alamat, atau legalitas.
- Pengusulan pendaftaran institusi baru yang belum terdata di SIS-LPI.
- Pengelompokan pengajuan menggunakan UUID `batch_id`.

---

## 5. Persyaratan Non-Fungsional (Non-Functional Requirements)

1. **Performa Spasial**:
   - Endpoint kueri marker peta `/api/institutions/map` harus merespons dalam waktu < 300 ms dengan payload teroptimasi (hanya kolom esensial, tanpa mentransfer geometri poligon utuh jika tidak diminta).
2. **Keamanan & Integritas Data**:
   - Kueri basis data menggunakan query builder **Drizzle ORM** yang sepenuhnya bertipe aman (*type-safe*) untuk mencegah serangan SQL Injection.
   - Password disimpan menggunakan hashing bergaram (`scrypt` + cryptographic salt).
   - Session authentication menggunakan token HMAC-SHA256 beralgoritma *timing-safe equality* pada cookie `session_token`.
   - Update dependensi Next.js ke **16.4.3** untuk menambal kerentanan keamanan yang dipublikasikan (security advisory).
3. **Kompatibilitas Spasial**:
   - Sistem koordinat acuan menggunakan standar **WGS 84 (EPSG:4326)**.
   - Kolom spasial PostGIS `geom` terindeks menggunakan GiST index untuk pencarian spasial dan kueri geodetik yang cepat.
4. **Responsivitas Antarmuka**:
   - Antarmuka responsif penuh dari layar ponsel (360px) hingga layar desktop ultra-wide (2560px) menggunakan Tailwind CSS v4.
   - Komponen peta Leaflet dimuat secara aman tanpa SSR (*client-side only*) untuk menghindari kesalahan hidrasi Node.js.
