# SIS-LPI — Sistem Informasi Spasial Lembaga Pendidikan Islam

Sistem Informasi Geografis (Web GIS) berbasis **Next.js 16 + Drizzle ORM + PostgreSQL/PostGIS** untuk pemetaan, inventarisasi aset lahan, legalitas wakaf, dan pengelolaan spasial lebih dari **35.900+ Lembaga Pendidikan Islam** (Pesantren, Madrasah, dan Perguruan Tinggi Keagamaan Islam / PTKI) di seluruh Indonesia.

---

## 🌟 Fitur Utama

### 1. Peta GIS Interaktif Nasional (`/`)
- Visualisasi clustering 35.900+ titik lembaga di seluruh provinsi Indonesia.
- Basemap dinamis: OpenStreetMap, Carto Light/Dark, dan Esri World Imagery (Satelit).
- Filtering instan berdasarkan: Provinsi, Tipe Lembaga (Pesantren, Madrasah, PTKI), Jenjang, Akreditasi, Status Lembaga, dan Pencarian teks / alias nama.
- **Filter "Hanya Lembaga Berpeta"**: Checkbox di Layer Peta untuk menyaring hanya institusi yang sudah memiliki data polygon batas wilayah (`has_polygon = true`).

### 2. Multi-Polygon Lahan per Institusi
- Satu institusi dapat memiliki **lebih dari 1 bidang polygon** (contoh: Kampus 1, Kampus 2, Lahan Asrama, Lapangan Olahraga).
- Editor interaktif di portal institusi untuk menggambar dan menyesuaikan sudut vertex polygon secara langsung pada peta satelit/jalan.
- Penghitungan otomatis luas bidang tanah dalam satuan meter persegi ($m^2$) dan Hektare (Ha) menggunakan algoritma geodesik sferikal.
- Visualisasi warna palet unik untuk setiap bidang polygon pada peta detail.

### 3. Titik Fasilitas Anak dalam Polygon (Child Points)
- **Persyaratan Ketat**: Titik fasilitas hanya dapat ditambahkan jika institusi sudah memiliki bidang polygon, dan koordinat titik harus berada **tepat di dalam polygon** (divalidasi dengan algoritma *Ray-Casting Point-in-Polygon*).
- **Fitur CRUD & Edit Lengkap**: Pengguna institusi dapat menambah, mengedit koordinat titik, mengubah kategori, mengubah nama gedung, serta memperbarui nilai variabel kustom titik kapan saja.
- **Variabel Kustom Bebas**: Setiap titik fasilitas dapat memiliki atribut dinamis tanpa batas (contoh: *Luas Lantai: 3.200 m²*, *Jumlah Lantai: 5*, *Kapasitas Santri: 1.500*, *Tahun Pembangunan: 2018*).
- **Alur Verifikasi Otomatis**: Setiap penambahan, pengeditan, atau penghapusan titik fasilitas otomatis mengubah status institusi menjadi **Pengajuan** sehingga perubahan menunggu validasi dan persetujuan Admin.
- **Kategori Fasilitas**: Perkantoran/Rektorat, Pendidikan/Kelas, Ibadah/Masjid, Asrama Santri, Fasilitas Olahraga, Laboratorium, dan Fasilitas Umum.
- **Privasi Tampilan**: Titik fasilitas ini **hanya tampil pada halaman detail institusi** (`/institutions/[id]`), menjaga peta GIS nasional tetap bersih dan ringan.

### 4. Manajemen Peran Pengguna (Role-Based Access Control)
Sistem memiliki 3 tingkat hak akses dengan alur verifikasi data:
1. **Super Admin**:
   - Memiliki kendali penuh atas sistem.
   - Dapat menambah, mengelola, dan menghapus akun Admin.
   - Dapat melakukan CRUD seluruh institusi dan menetapkan status validitas data.
2. **Admin**:
   - Dapat mengelola data institusi (CRUD Institusi).
   - Memeriksa pengajuan perubahan data dan polygon dari institusi.
   - Memberikan status data institusi: **Valid**, **Pengajuan** (Pending), atau **Tidak Valid**.
3. **User Institusi**:
   - Login mandiri khusus untuk lembaganya sendiri (menggunakan ID lembaga).
   - Dapat memperbarui profil institusi, menggambar multiple polygon lahan, dan mengelola titik fasilitas (child points).
   - Setiap perubahan yang disimpan otomatis berstatus **Pengajuan** untuk diverifikasi oleh Admin.

---

## 🔑 Kredensial Default Akun

Semua akun institusi telah digeneratekan secara otomatis ke dalam database:

| Role | Username | Password Default | Keterangan |
|---|---|---|---|
| **Super Admin** | `superadmin` | `superadmin123` | Akses penuh + Kelola Admin |
| **Admin** | `admin` | `admin123` | Manajemen Institusi & Verifikasi |
| **Institusi (35.902 Akun)** | `ID Lembaga` (contoh: `01375`, `18076`, `00639`) | `institusi123` | Akun mandiri untuk tiap lembaga terdaftar |

> **Catatan Keamanan**: Seluruh password disimpan dalam bentuk hash kriptografis `scrypt` dengan unique salt acak per pengguna.

---

## 🧭 Panduan Navigasi Halaman

| Rute URL | Pengguna | Deskripsi Halaman |
|---|---|---|
| `/` | Publik / Semua | Peta Web GIS Nasional dengan drawer detail, pencarian, dan filter "Hanya Lembaga Berpeta" |
| `/institutions/[id]` | Publik / Semua | Halaman Detail Institusi (peta multi-polygon dengan **tombol fullscreen**, daftar titik fasilitas child points, valuasi NJOP, dan legalitas aset) |
| `/login` | Semua Role | Portal masuk terpadu (diakses dari **satu tombol Login** di sidebar peta) |
| `/admin/institutions` | Super Admin / Admin | Tabel CRUD institusi lengkap dengan filter verifikasi, indikator polygon, dan tombol aksi validasi cepat |
| `/admin` | Super Admin / Admin | Panel review pengajuan usulan koreksi data & polygon |
| `/institusi/edit` | User Institusi | Dashboard mandiri lembaga untuk mengedit informasi, menggambar multi-polygon, dan mengelola titik fasilitas gedung |

---

## 🛠️ Arsitektur Teknologi

- **Frontend**: Next.js 16.4 (Turbopack, App Router), React 19, Tailwind CSS v4, Lucide React
- **Peta Spasial**: Leaflet 1.9, Leaflet MarkerCluster, Esri ArcGIS World Imagery, OpenStreetMap
- **Backend**: Next.js Route Handlers (`app/api/*`)
- **Database**: PostgreSQL 16 + PostGIS
- **ORM & Migrations**: Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Algoritma Geospasial**:
  - `normalizePolygons`: Menangani single array coordinates, array of polygon objects, dan GeoJSON.
  - `isPointInPolygon` & `isPointInAnyPolygon`: Algoritma *Ray-Casting* untuk validasi titik di dalam bidang tanah.
  - `calculateAreaM2`: Kalkulasi luas polygon di atas kurvatur bola bumi (*WGS84 ellipsoid*).

---

## 🚀 Menjalankan Aplikasi Lokal

### 1. Prasyarat
- Node.js 18+ (atau Bun / pnpm)
- PostgreSQL dengan ekstensi PostGIS aktif
- Database `sis-lpi` terkonfigurasi pada file `.env`:
  ```env
  DATABASE_URL=postgresql://postgres:admin@localhost:5432/sis-lpi
  ADMIN_PASSWORD=admin
  SECRET_KEY=sis-lpi-super-secret-key-2026
  ```

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Menjalankan Server Development
```bash
npm run dev
```
Buka browser di [http://localhost:3000](http://localhost:3000).

### 4. Build untuk Produksi
```bash
npm run build
npm start
```

---

## 📡 Dokumentasi Endpoint API Penting

### Otentikasi
- `POST /api/auth/login` — Login terpadu untuk semua peran (`username`, `password`).
- `POST /api/auth/logout` — Logout dan pembersihan cookie sesi.
- `GET /api/auth/me` — Mendapatkan profil user yang sedang aktif.

### Data Institusi & Spasial
- `GET /api/institutions/map` — Data titik koordinat ringan untuk marker clustering GIS.
- `GET /api/institutions/polygons` — GeoJSON batas luar polygon lahan dan sub-zonasi.
- `GET /api/institutions/[id]` — Detail lengkap institusi, bidang polygon normalized, dan titik fasilitas child points.
- `GET /api/institutions/[id]/child-points` — Mengambil seluruh titik fasilitas untuk institusi.
- `POST /api/institutions/[id]/child-points` — Menambah titik fasilitas (wajib validasi dalam polygon).
- `DELETE /api/institutions/[id]/child-points/[pointId]` — Menghapus titik fasilitas.
- `PATCH /api/institutions/[id]/child-points/[pointId]` — Memperbarui data titik fasilitas.

### Manajemen Institusi & Verifikasi
- `GET /api/admin/institutions` — Daftar institusi paginasi dengan filter status verifikasi (`valid`, `pengajuan`, `tidak_valid`).
- `POST /api/admin/institutions` — Menambah data institusi baru.
- `POST /api/admin/institutions/[id]/status` — Mengubah status verifikasi data institusi.
- `GET /api/institusi/me` — Mengambil data institusi milik user yang sedang login.
- `PUT /api/institusi/me` — Menyimpan pembaruan data dan multi-polygon (status otomatis menjadi `pengajuan`).
