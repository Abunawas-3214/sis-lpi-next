# LAPORAN PEMBUATAN APLIKASI
# SIS-LPI (Sistem Informasi Spasial Lembaga Pendidikan Islam)

**Versi Dokumen:** 1.0.0
**Tanggal:** Oktober 2026
**Status:** Dokumentasi Resmi Pembuatan & Arsitektur Perangkat Lunak

---

## 📋 DAFTAR ISI

1. [PENDAHULUAN & LATAR BELAKANG](#1-pendahuluan--latar-belakang)
   - 1.1 Gambaran Umum Aplikasi
   - 1.2 Masalah Bisnis & Peluang Solusi
   - 1.3 Visi & Tujuan Strategis
2. [ARSITEKTUR SISTEM (SYSTEM ARCHITECTURE)](#2-arsitektur-sistem-system-architecture)
   - 2.1 Manca Negara & High-Level Architecture
   - 2.2 Lapisan Sistem & Separasi Tanggung Jawab
   - 2.3 Model Data & Diagram Entitas (ERD)
   - 2.4 Keamanan & Sistem Otentikasi
3. [TEKNOLOGI & DEPENDENSI (TECH STACK)](#3-teknologi--dependensi-tech-stack)
   - 3.1 Framework Web & Bahasa Pemrograman
   - 3.2 Engine Web GIS & Komputasi Spasial
   - 3.3 Basis Data & ORM
4. [DESAIN ANTARMUKA & UI/UX (DESIGN SYSTEM)](#4-desain-antarmuka--uiux-design-system)
   - 4.1 Palette Warna & Identitas Visual
   - 4.2 Tata Letak & komponen Antarmuka
5. [FITUR-FITUR UTAMA APLIKASI](#5-fitur-fitur-utama-aplikasi)
   - 5.1 Peta Web GIS Interaktif Nasional (Tingkat Makro)
   - 5.2 Multi-Polygon Lahan & Aset Tanah (Tingkat Mikro)
   - 5.3 Titik Fasilitas Anak (*Child Points*) dengan *Spatial Containment Rule*
   - 5.4 Manajemen Hak Akses Multi-Peran (RBAC 3 Tier)
   - 5.5 Alur Kerja Verifikasi & Penjaminan Mutu Data
   - 5.6 Crowdsourcing & Usulan Koreksi Publik (*Suggested Edits*)
   - 5.7 Valuasi Ekonomi & Legalitas Aset Tanah (NJOP & Sertifikat)
6. [KEGUNAAN & MANFAAT APLIKASI](#6-kegunaan--manfaat-aplikasi)
   - 6.1 Bagi Kementerian Agama & Regulator
   - 6.2 Bagi Pengelola & Operator Lembaga
   - 6.3 Bagi Masyarakat Umum, Santri, Orang Tua, & Peneliti
7. [KESIMPULAN](#7-kesimpulan)

---

## 1. PENDAHULUAN & LATAR BELAKANG

### 1.1 Gambaran Umum Aplikasi
**SIS-LPI (Sistem Informasi Spasial Lembaga Pendidikan Islam)** adalah platform Web GIS (*Geographic Information System*) berbasis web modern yang dirancang untuk memetakan, menginventarisasi, menganalisis, serta mengelola data spasial dan atribut kelembagaan lebih dari **35.900+ Lembaga Pendidikan Islam** yang tersebar di seluruh wilayah Negara Kesatuan Republik Indonesia.

Sistem ini mencakup tiga pilar utama pendidikan Islam di Indonesia:
1. **Pondok Pesantren**: Pesantren Salafiyah, Ashriyah, Mu'adalah, Pendidikan Diniyah Formal (PDF), dan Pesantren Takhasus.
2. **Madrasah**: Raudhatul Athfal (RA), Madrasah Ibtidaiyah (MI), Madrasah Tsanawiyah (MTs), dan Madrasah Aliyah (MA/MAK).
3. **Perguruan Tinggi Keagamaan Islam (PTKI)**: Universitas Islam Negeri (UIN), Institut Agama Islam Negeri (IAIN), Sekolah Tinggi Agama Islam Negeri (STAIN), serta Perguruan Tinggi Keagamaan Islam Swasta (PTKIS).

### 1.2 Masalah Bisnis & Peluang Solusi
Sebelum hadirnya SIS-LPI, inventarisasi data lembaga pendidikan Islam menghadapi tantangan besar:
- **Pendataan Terpisah & Tidak Terstandarisasi**: Data koordinat dan legalitas aset tanah tersebar di berbagai sistem tanpa visualisasi spasial yang presisi.
- **Batas Lahan Tidak Terpetakan**: Aset tanah wakaf atau hibah lembaga sering kali hanya berupa pencatatan angka hektare tanpa pemetaan batas poligon yang jelas di atas peta satelit.
- **Satu Titik Tidak Cukup**: Kompleks kampus pendidikan Islam yang memiliki banyak bangunan (asrama, rektorat, masjid, laboratorium) membutuhkan pendataan spasial hingga tingkat fasilitas mikro (*child points*).
- **Verifikasi Lambat**: Ketiadaan portal mandiri yang terhubung langsung dengan alur verifikasi tingkat verifikator/admin wilayah.

SIS-LPI menjawab tantangan ini dengan menghadirkan **Dual-Level Web GIS** (Tingkat Makro untuk sebaran nasional dan Tingkat Mikro untuk detail bidang tanah serta bangunan) yang dilengkapi alur verifikasi terpadu.

### 1.3 Visi & Tujuan Strategis
- **Akurasi & Akuntabilitas Aset Wakaf/Lahan**: Menghadirkan transparansi legalitas sertifikat tanah, status kepemilikan, dan estimasi valuasi NJOP aset lembaga pendidikan Islam.
- **Kecepatan Akses Data**: Menyajikan peta interaktif berkinerja tinggi yang mampu merender puluhan ribu titik lembaga tanpa pembekuan antarmuka (*UI freezing*).
- **Partisipasi Mandiri & Crowdsourcing**: Memberikan akses login mandiri bagi 35.900+ lembaga serta membuka kanal pengusulan koreksi bagi masyarakat umum.

---

## 2. ARSITEKTUR SISTEM (SYSTEM ARCHITECTURE)

### 2.1 Manca Negara & High-Level Architecture
SIS-LPI dibangun menggunakan arsitektur **Modern Modular Monolith** berbasis **Next.js 16 (App Router)**. Arsitektur ini menggabungkan keunggulan *Server Component*, *Route Handlers* (REST API), *Spatial Geometry Engine*, dan *Persistence Layer* dalam satu fondasi yang terkoordinasi rapi.

```
+-----------------------------------------------------------------------+
|                         CLIENT LAYER (BROWSER)                        |
|   +-------------------+  +---------------------+  +---------------+   |
|   |   Masyarakat      |  |  Operator Lembaga   |  |     Admin     |   |
|   |  (Peta Nasional)  |  | (Polygon Editor)    |  | (Verifikator) |   |
|   +---------+---------+  +----------+----------+  +-------+-------+   |
+-------------|-----------------------|---------------------|-----------+
              | HTTPS                 | HTTPS + Session     | HTTPS + Session
+-------------v-----------------------v---------------------v-----------+
|                   NEXT.JS 16 APPLICATION LAYER                        |
|                                                                       |
|   +---------------------------------------------------------------+   |
|   | React 19 UI & GIS Presentation Layer                          |   |
|   | (Leaflet Dynamic, MarkerCluster, Floating Sidebar, Drawers)   |   |
|   +-------------------------------+-------------------------------+   |
|                                   |                                   |
|   +-------------------------------+-------------------------------+   |
|   | Route Handlers (REST API /app/api/*)                          |   |
|   | - /api/institutions/map (Payload Cepat <300ms)                |   |
|   | - /api/institutions/[id]/child-points (CRUD Fasilitas)        |   |
|   | - /api/auth/* & /api/admin/* (RBAC & Verifikasi)               |   |
|   +-------+-----------------------+-----------------------+-------+   |
|           |                       |                       |           |
|           v                       v                       v           |
|   +---------------+       +---------------+       +---------------+   |
|   | Security Guard|       | Spatial Engine|       | Drizzle ORM   |   |
|   | (HMAC Token)  |       | (Ray-Casting) |       | Engine        |   |
|   +---------------+       +---------------+       +-------+-------+   |
+-----------------------------------------------------------|-----------+
                                                            | TCP Connection
+-----------------------------------------------------------v-----------+
|                   DATA LAYER (NEON POSTGRESQL + POSTGIS)              |
|   - 35.900+ Data Lembaga, Batas Poligon, & Titik Fasilitas            |
|   - Spatial GiST Indexes (idx_institutions_geom)                      |
+-----------------------------------------------------------------------+
```

### 2.2 Lapisan Sistem & Separasi Tanggung Jawab

1. **Presentation Layer (React 19 Server & Client Components)**:
   - Server Components merender halaman secara optimal di server untuk kecepatan muat awal dan SEO.
   - Client Components (`"use client"`) digunakan untuk komponen peta interaktif Leaflet (`MapContainer`, `PolygonMapEditor`, `MarkerCluster`), filter dinamis, dan modal dialog.
2. **API & Route Handlers Layer (`app/api/*`)**:
   - Menyediakan endpoint RESTful yang bertipe aman (*type-safe*).
   - Mengelola serialisasi data, pengalihan otorisasi, dan validasi input.
3. **Spatial Geometry Engine (`lib/geometry.ts`)**:
   - Mesin komputasi geospasial murni di sisi server.
   - **Algoritma Ray-Casting**: Memvalidasi apakah suatu titik koordinat berada tepat di dalam batas poligon (*Point-in-Polygon*).
   - **Kalkulator Luas Geodesik**: Menghitung luas permukaan tanah ($m^2$ dan Hektare) pada kurvatur ellipsoid bola bumi WGS84.
4. **Persistence Layer (Drizzle ORM & PostGIS)**:
   - Drizzle ORM memetakan objek TypeScript ke tabel PostgreSQL secara *strictly typed*.
   - PostgreSQL 16 dengan ekstensi PostGIS menyimpan titik koordinat dan indeks spasial GiST.

### 2.3 Model Data & Diagram Entitas (ERD)

Sistem mengelola lima tabel utama yang saling terhubungkan:

- **`institutions`**: Tabel master 35.900+ lembaga (ID, nama, tipe, jenjang, status, provinsi, kota, titik PostGIS `geom`, status legalitas tanah, NJOP, dan `verification_status`).
- **`institution_polygons`**: Tabel bidang tanah lembaga (1 institusi dapat memiliki *1 to N* bidang polygon).
- **`institution_child_points`**: Tabel titik fasilitas internal gedung/bangunan (terikat pada institusi dan polygon).
- **`users`**: Tabel akun pengguna (Super Admin, Admin, dan 35.902 akun institusi).
- **`suggested_edits`**: Tabel usulan perubahan data dari publik (crowdsourcing) dengan dukungan `batch_id`.

```
+-------------------+       1..N       +----------------------+
|   INSTITUTIONS    |<-----------------| INSTITUTION_POLYGONS |
+-------------------+                  +----------------------+
| id (PK, 01375)    |                             ^
| name              |                             | 1..N
| type, level       |                             |
| province, city    |       1..N       +----------+-----------+
| geom (Point)      |----------------->| INSTITUTION_CHILD_   |
| verification_     |                  | POINTS               |
| status            |                  +----------------------+
+---------+---------+                  | id (PK)              |
          |                            | polygon_id (FK)      |
          | 1..1                       | name, category       |
+---------v---------+                  | lat, lng             |
|       USERS       |                  | custom_variables     |
+-------------------+                  +----------------------+
| id (PK)           |
| username          |
| role, password    |
+-------------------+
```

### 2.4 Keamanan & Sistem Otentikasi
- **Password Hashing**: Menggunakan algoritma kriptografi `scrypt` dengan unique salt 16-byte acak per pengguna.
- **Timing-Safe Protection**: Verifikasi hash dan tanda tangan HMAC menggunakan `crypto.timingSafeEqual` untuk mencegah *timing attack*.
- **Session Tokens**: Token sesi berbasis HMAC-SHA256 yang disimpan pada cookie browser `HttpOnly`, `Secure`, dan `SameSite=Lax`.

---

## 3. TEKNOLOGI & DEPENDENSI (TECH STACK)

### 3.1 Framework Web & Bahasa Pemrograman
- **Runtime & Package Manager**: **Bun v1.4+** — Runtime JavaScript/TypeScript performa tinggi.
- **Framework Utama**: **Next.js 16.4.3 (App Router & Turbopack)** — Framework React standar industri untuk aplikasi web modern.
- **UI Framework**: **React 19.3** — Menggunakan fitur komputasi async dan rendering terpisah.
- **Bahasa Pemrograman**: **TypeScript 5.x** — Menjamin keandalan tipe data (*type safety*) di seluruh baris kode.

### 3.2 Engine Web GIS & Komputasi Spasial
- **Peta Interaktif**: **Leaflet 1.9.4** — Library pemetaan web berkinerja tinggi.
- **Marker Clustering**: **Leaflet.markercluster 1.5.3** — Mengelompokkan puluhan ribu marker secara dinamis tanpa membuat browser lambat.
- **Tile Provider / Basemap**:
  - OpenStreetMap (OSM Standard)
  - Carto Light / Positron (Mode Terang)
  - Carto Dark / Dark Matter (Mode Gelap Kontras Tinggi)
  - Esri World Imagery (Foto Satelit Resolusi Tinggi)
- **Algoritma Geospasial Kustom**:
  - Algoritma *Ray-Casting Point-in-Polygon*.
  - Kalkulasi Luas Geodesik Sferikal ($m^2$ & Ha).

### 3.3 Basis Data & ORM
- **Database Engine**: **PostgreSQL 16+ dengan ekstensi PostGIS** (Disertakan di Neon Serverless Postgres Cloud).
- **ORM (Object-Relational Mapping)**: **Drizzle ORM v1.0-rc4** — Query builder SQL bertipe aman tanpa overhead runtime.
- **Database Driver**: **`pg` (node-postgres)** dengan pooling koneksi otomatis.

---

## 4. DESAIN ANTARMUKA & UI/UX (DESIGN SYSTEM)

### 4.1 Palette Warna & Identitas Visual
Sistem menggunakan skema warna **Islamic Modern GIS Palette**:
- **Emerald Green (`#059669` / `emerald-600`)**: Warna aksen utama melambangkan identitas Pendidikan Islam dan Pondok Pesantren.
- **Amber Gold (`#d97706` / `amber-600`)**: Warna aksen identitas Madrasah.
- **Indigo Blue (`#4f46e5` / `indigo-600`)**: Warna aksen identitas Perguruan Tinggi Islam (PTKI).
- **Glassmorphism Design**: Efek `backdrop-blur-md bg-white/90` pada panel navigasi terapung di atas peta untuk memberikan kesan bersih, modern, dan tidak menghalangi tampilan peta.

```
+--------------------------------------------------------------------+
|  WARNA INDIKATOR LAYER / MARKER INSTITUSI                          |
|                                                                    |
|  [ Emerald #059669 ]  --> Pondok Pesantren                        |
|  [ Amber   #d97706 ]  --> Madrasah (RA, MI, MTs, MA)               |
|  [ Indigo  #4f46e5 ]  --> Perguruan Tinggi Keagamaan Islam (PTKI)  |
+--------------------------------------------------------------------+
```

### 4.2 Tata Letak & Komponen Antarmuka

1. **Peta Penuh Layar (*Full-Height GIS Canvas*)**:
   - Peta memenuhi 100% viewport layar sebagai panggung utama.
   - Dilengkapi kontrol zoom, pemilih basemap satelit/jalan, serta toggle layer poligon.
2. **Floating Search & Filter Sidebar (Sisi Kiri)**:
   - Panel pencarian cepat dengan dukungan alias pintar (`uin`, `ponpes`, `iain`, `man`, dll.).
   - Accordion filter multi-dimensi (Provinsi, Tipe, Jenjang, Akreditasi, Status Lembaga, dan Checkbox "Hanya Lembaga Berpeta").
3. **Slide-Over Detail Drawer (Sisi Kanan)**:
   - Ketika pengguna mengklik salah satu titik di peta, drawer meluncur dari sisi kanan menampilkan ringkasan profil, legalitas tanah, dan daftar gedung tanpa memutus pandangan peta.
4. **Independent Polygon Canvas (`/polygon-editor/*`)**:
   - Antarmuka khusus menggambar batas lahan dengan kanvas terisolasi, dilengkapi toolbar 5 mode (Geser, Tambah Titik, Pindah Titik, Sisipkan Titik, Hapus Titik), tombol Reset, dan indikator deteksi *Self-Intersection*.

---

## 5. FITUR-FITUR UTAMA APLIKASI

### 5.1 Peta Web GIS Interaktif Nasional (Tingkat Makro)
- **Visualisasi Clustering 35.900+ Titik**: Menampilkan sebaran seluruh lembaga pendidikan Islam dari Sabang sampai Merauke secara cepat (< 300ms response time).
- **Filter Multi-Dimensi Real-Time**:
  - Filter Provinsi (dengan jumlah agregat lembaga per provinsi).
  - Filter Tipe Lembaga (Pesantren, Madrasah, PTKI).
  - Filter Jenjang & Akreditasi.
  - **Filter "Hanya Lembaga Berpeta"**: Checkbox di layer peta untuk menyaring khusus institusi yang sudah memiliki data batas lahan polygon (`has_polygon = true`).
- **Pencarian Cerdas (*Smart Search*)**: Mengenali singkatan umum masyarakat Indonesia.

### 5.2 Multi-Polygon Lahan & Aset Tanah (Tingkat Mikro)
- **Multi-Parcel Support**: Satu institusi dapat memiliki lebih dari 1 bidang polygon tanah (contoh: *Kampus Utama*, *Kampus 2*, *Lahan Asrama Putra*, *Lapangan Olahraga*).
- **Kalkulasi Luas Otomatis**: Luas setiap bidang tanah dihitung secara otomatis dalam satuan Meter Persegi ($m^2$) dan Hektare (Ha) berdasarkan algoritma geodesik.
- **Visualisasi Palet Unik**: Setiap bidang tanah diberi warna pembeda pada peta detail institusi.

### 5.3 Titik Fasilitas Anak (*Child Points*) dengan *Spatial Containment Rule*
- **Pendataan Fasilitas Mikro**: Memungkinkan institusi menandai lokasi fisik gedung rektorat, ruang kelas, asrama santri, masjid, laboratorium, dan fasilitas olahraga.
- **Persyaratan Ketat Integritas Spasial**: Titik fasilitas **hanya dapat ditambahkan jika institusi sudah memiliki poligon tanah**, dan posisi titik **wajib berada di dalam poligon** (divalidasi dengan algoritma *Ray-Casting Point-in-Polygon* di server).
- **Variabel Kustom Fleksibel**: Setiap fasilitas dapat memiliki metadata dinamis bebas (contoh: *Kapasitas Santri: 1.200*, *Jumlah Lantai: 4*, *Tahun Renovasi: 2022*).
- **Privasi Tampilan**: Titik fasilitas mikro ini hanya ditampilkan pada halaman detail institusi (`/institutions/[id]`), menjaga peta nasional tetap bersih.

### 5.4 Manajemen Hak Akses Multi-Peran (RBAC 3 Tier)
1. **Super Admin**: Akses penuh ke seluruh sistem, manajemen pengguna (35.904 akun), dan override verifikasi.
2. **Admin Verifikator**: Meninjau pengajuan perubahan dari lembaga, memverifikasi data, serta menyetujui/menolak usulan crowdsourcing publik.
3. **User Institusi**: Login mandiri khusus untuk lembaganya (menggunakan ID Lembaga, misal `01375`). Dapat mengedit profil, menggambar multi-polygon lahan, dan mengelola titik fasilitas gedung.

### 5.5 Alur Kerja Verifikasi & Penjaminan Mutu Data
Untuk menjamin akurasi data master, setiap perubahan yang dilakukan oleh User Institusi atau publik tidak langsung menjadi data resmi, melainkan melalui **State Machine Verifikasi**:

```
 [Data Master Valid]
        |
        +---> Operator Lembaga / Publik Mengubah Data
        |
 [Status: PENGAJUAN (Pending)]
        |
        +---> Admin Melakukan Peninjauan (Diff Viewer)
        |
        +---( Disetujui )---> [Status: VALID] (Diperbarui di Peta)
        |
        +---( Ditolak )-----> [Status: PERBAIKAN] (Dikembalikan ke Lembaga)
```

### 5.6 Crowdsourcing & Usulan Koreksi Publik (*Suggested Edits*)
- Masyarakat umum, santri, atau alumni dapat mengusulkan koreksi data atau pendaftaran lembaga baru tanpa perlu login.
- Peninjauan admin dilengkapi fitur **Diff Viewer** (membandingkan nilai lama vs nilai baru secara visual dengan warna hijau & merah).
- Mendukung persetujuan massal (*Batch Approval*) berdasarkan UUID `batch_id`.

### 5.7 Valuasi Ekonomi & Legalitas Aset Tanah (NJOP & Sertifikat)
- **Legalitas Aset**: Pencatatan status sertifikat (Sertifikat Hak Milik / SHM, Hak Pakai, Wakaf Terdaftar, Girik/Petok D) beserta nomor sertifikat resmi.
- **Zonasi Peruntukan Lahan**: Rincian pembagian area untuk pendidikan, ibadah, asrama, olahraga, dan unit usaha ekonomi.
- **Aspek Ekonomi Tanah**: Pencatatan Nilai Jual Objek Pajak (NJOP) per $m^2$, estimasi harga pasar, dan total valuasi nilai aset tanah lembaga.

---

## 6. KEGUNAAN & MANFAAT APLIKASI

### 6.1 Bagi Kementerian Agama & Regulator
- **Inventarisasi Aset Wakaf Nasional**: Menyediakan database spasial terpusat untuk memantau keberadaan dan legalitas tanah wakaf lembaga pendidikan Islam di seluruh Indonesia.
- **Perencanaan Pembangunan & Bantuan**: Membantu pengambil kebijakan dalam menyalurkan bantuan sarana/prasarana secara tepat sasaran berbasis pemetaan spasial fasilitas yang ada.
- **Pengawasan & Validasi Data**: Memudahkan verifikasi data lembaga secara berjenjang dan akuntabel.

### 6.2 Bagi Pengelola & Operator Lembaga
- **Sertifikasi & Pemetaan Digital Mandiri**: Memiliki peta digital resmi batas tanah dan fasilitas kampus yang dapat digunakan untuk keperluan akreditasi, pengajuan hibah, atau profil lembaga.
- **Manajemen Aset Internal**: Memudahkan inventarisasi luas lahan, kapasitas gedung, dan zonasi penggunaan tanah lembaga secara terstruktur.
- **Kemudahan Akses**: Portal mandiri yang mudah diakses kapan saja untuk memperbarui data lembaga.

### 6.3 Bagi Masyarakat Umum, Santri, Orang Tua, & Peneliti
- **Transparansi Informasi**: Memudahkan orang tua dan calon santri/mahasiswa dalam mencari lokasi, profil, akreditasi, dan fasilitas lembaga pendidikan Islam.
- **Kanal Partisipasi Publik**: Memberikan ruang bagi masyarakat untuk ikut serta menjaga keakuratan data melalui fitur pengusulan koreksi (*crowdsourcing*).
- **Rujukan Penelitian Geospasial**: Menjadi sumber data riset akademis mengenai sebaran spasial pendidikan Islam di Indonesia.

---

## 7. KESIMPULAN

Aplikasi **SIS-LPI (Sistem Informasi Spasial Lembaga Pendidikan Islam)** merupakan terobosan teknologi Web GIS yang berhasil mengintegrasikan pemetaan spasial skala nasional (35.900+ lembaga) dengan pendataan aset tingkat mikro (multi-polygon tanah dan titik fasilitas gedung).

Dengan fondasi arsitektur **Next.js 16**, **React 19**, **Drizzle ORM**, dan **PostgreSQL/PostGIS**, aplikasi ini tidak hanya menawarkan performa tinggi dan tampilan antarmuka yang modern, tetapi juga menjamin keamanan serta integritas data melalui alur kerja verifikasi terpadu. SIS-LPI siap menjadi pilar utama dalam digitalisasi tata kelola aset dan geospasial lembaga pendidikan Islam di Indonesia.
