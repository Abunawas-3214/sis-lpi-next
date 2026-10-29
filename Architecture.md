# Arsitektur Sistem & Spesifikasi Teknis — SIS-LPI Next
**Sistem Informasi Spasial Lembaga Pendidikan Islam (Next.js Edition)**

Dokumen ini mendefinisikan arsitektur sistem perangkat lunak, perancangan basis data, model spasial, alur verifikasi data, serta mekanisme keamanan pada **SIS-LPI Next**.

---

## 1. Tinjauan Arsitektur Tingkat Tinggi (High-Level Architecture)

SIS-LPI Next menerapkan arsitektur monolitik modular modern (*modern modular monolith*) berbasis **Next.js 16 (App Router)** dengan pemisahan tanggung jawab yang tegas antara lapisan presentasi, lapisan API/Route Handlers, modul domain spasial, dan lapisan persistensi data Drizzle ORM.

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (Browser)"]
        PublicUser["Pengguna Publik / Santri\n(Peta Makro, Filter, Crowdsource)"]
        InstUser["Operator Lembaga\n(Portal /institusi, Polygon Editor)"]
        AdminUser["Admin Verifikator\n(Panel /admin, Validasi Status)"]
    end

    subgraph AppLayer ["Next.js 16 (App Router)"]
        UI_Components["React 19 Server & Client Components\n(Leaflet Dynamic, Tailwind CSS v4)"]
        RouteHandlers["Route Handlers (REST Endpoints)\n(/api/institutions, /api/auth, /api/admin)"]
        AuthMiddleware["Security & Auth Guard\n(HMAC-SHA256 Session Cookie)"]
        SpatialEngine["Spatial Geometry Engine\n(Point-in-Polygon, Geodesic Area Calc)"]
    end

    subgraph DataLayer ["Data & Persistence Layer"]
        Drizzle["Drizzle ORM Engine\n(Type-safe Query Builder)"]
        NeonDB[("PostgreSQL 16 + PostGIS\n(Neon Cloud Serverless, 35.900+ Data Lembaga)")]
    end

    PublicUser -->|HTTPS| UI_Components
    InstUser -->|HTTPS + Session| UI_Components
    AdminUser -->|HTTPS + Session| UI_Components

    UI_Components --> RouteHandlers
    RouteHandlers --> AuthMiddleware
    RouteHandlers --> SpatialEngine
    RouteHandlers --> Drizzle
    Drizzle -->|TCP Connection Pool| NeonDB
```

---

## 2. Lapisan Sistem (System Layers & Responsibilities)

### 2.1 Lapisan Presentasi (Presentation Layer)
- **Komponen Server (React Server Components)**:
  - Mengambil data awal secara efisien di server tanpa overhead pengiriman JavaScript client. Digunakan pada rute `/institutions/[id]` untuk optimasi SEO dan initial page load.
- **Komponen Klien (`"use client"`)**:
  - Peta Interaktif Leaflet (`MapContainer.tsx`, `MarkerCluster.tsx`, `PolygonMapEditor.tsx`, `MiniMap.tsx`).
  - Bilah Filter dan Pencarian Cerdas (`SearchFilterSidebar.tsx`).
  - Drawer rincian data dan formulir usulan perubahan (`InstitutionDetailDrawer.tsx`, `SuggestEditModal.tsx`).
- **Aturan Pemuatan Peta**: Seluruh modul yang bergantung pada Leaflet wajib dimuat dengan `next/dynamic` opsi `{ ssr: false }` untuk mencegah eksekusi pada lingkungan server Node.js.

### 2.2 Lapisan API & Rute Layanan (Route Handlers)
- Berada di dalam direktori `app/api/*`.
- Mengimplementasikan pola RESTful dengan validasi input tipe data dan penanganan kesalahan terpusat.
- Mengembalikan response JSON standar dengan status HTTP yang tepat (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `500 Internal Server Error`).

### 2.3 Lapisan Domain & Mesin Spasial (Spatial Geometry Engine)
- Berada di [`lib/geometry.ts`](file:///D:/Abun/Projects/sis-lpi-next/lib/geometry.ts).
- Bertanggung jawab melakukan komputasi geometri:
  1. **Algoritma Point-in-Polygon (Ray-Casting Algorithm)**: Menentukan secara presisi apakah suatu koordinat titik fasilitas berada di dalam koordinat batas polygon lembaga.
  2. **Kalkulator Luas Poligon Geodesik**: Menghitung estimasi luas area bidang tanah dalam meter persegi ($m^2$) dengan mempertimbangkan kelengkungan bumi (proyeksi sferis).
  3. **Normalisasi Multi-Polygon**: Menstandarkan struktur format koordinat polygon (Multi-ring, sub-parcels, GeoJSON).

### 2.4 Lapisan Persistensi Data (Persistence Layer)
- Menggunakan **Drizzle ORM** yang bertipe aman (*strictly typed*).
- Menghubungkan aplikasi ke PostgreSQL melalui driver `pg` dengan pooling koneksi otomatis.
- Skema terpusat di [`lib/db/schema.ts`](file:///D:/Abun/Projects/sis-lpi-next/lib/db/schema.ts).

---

## 3. Model Data & Diagram Entitas (Entity-Relationship Diagram)

```mermaid
erDiagram
    INSTITUTIONS ||--o{ INSTITUTION_POLYGONS : "memiliki 1..n bidang tanah"
    INSTITUTIONS ||--o{ INSTITUTION_CHILD_POINTS : "memiliki 0..n fasilitas gedung"
    INSTITUTION_POLYGONS ||--o{ INSTITUTION_CHILD_POINTS : "melingkupi"
    INSTITUTIONS ||--o{ SUGGESTED_EDITS : "memiliki riwayat koreksi"
    INSTITUTIONS ||--o| USERS : "memiliki akun akses institusi"

    INSTITUTIONS {
        varchar(10) id PK "Kode unik lembaga, misal: 01375"
        varchar(500) name "Nama resmi lembaga"
        varchar(50) type "pesantren / madrasah / universitas"
        varchar(20) level "Tingkat pendidikan (MI, MTs, MA, S1, dll)"
        varchar(20) status "Negeri / Swasta"
        varchar(100) province "Provinsi"
        varchar(100) city "Kabupaten / Kota"
        geometry geom "Titik koordinat PostGIS (WGS 84)"
        double_precision latitude "Latitude desimal"
        double_precision longitude "Longitude desimal"
        double_precision land_total_area_m2 "Total luas tanah m2"
        json land_ownership "Informasi kepemilikan (Wakaf, Milik, dll)"
        json land_geometry "GeoJSON batas lahan lembaga"
        varchar(100) land_certificate_status "Status sertifikat tanah"
        varchar(100) land_njop "Nilai NJOP per m2"
        varchar(100) land_estimated_total_value "Estimasi total valuasi aset"
        varchar(30) verification_status "valid / pengajuan / perbaikan"
        timestamp updated_at "Waktu terakhir pembaruan"
    }

    INSTITUTION_POLYGONS {
        varchar id PK "ID bidang polygon, misal: poly-01375-1"
        varchar(10) institution_id FK "Relasi ke institutions.id"
        varchar name "Nama bidang tanah, misal: Kampus 1"
        json coordinates "Array koordinat vertex [lng, lat]"
        double_precision area_m2 "Luas area dalam m2"
        timestamp created_at "Waktu pembuatan"
        timestamp updated_at "Waktu pembaruan"
    }

    INSTITUTION_CHILD_POINTS {
        serial id PK "ID auto-increment titik fasilitas"
        varchar(10) institution_id FK "Relasi ke institutions.id"
        varchar(100) polygon_id FK "Relasi ke institution_polygons.id"
        varchar(255) polygon_name "Nama bidang polygon terkait"
        varchar(255) name "Nama fasilitas, misal: Masjid Ulul Albab"
        varchar(100) category "gedung / ibadah / pendidikan / asrama"
        double_precision latitude "Koordinat latitude fasilitas"
        double_precision longitude "Koordinat longitude fasilitas"
        json custom_variables "Metadata fleksibel (jumlah lantai, kapasitas)"
        text notes "Catatan tambahan"
    }

    USERS {
        serial id PK "ID pengguna"
        varchar(100) username UK "Username unik (ID Lembaga atau Admin)"
        varchar(255) password "Password hash scrypt"
        varchar(255) name "Nama pengguna atau nama lembaga"
        varchar(50) role "super_admin / admin / institusi"
        varchar(10) institution_id "ID Lembaga bagi user role institusi"
        varchar(255) email "Email kontak"
        boolean is_active "Status aktif akun"
    }

    SUGGESTED_EDITS {
        serial id PK "ID usulan perubahan"
        varchar(36) batch_id "UUID pengelompokan usulan"
        varchar(10) institution_id "ID Lembaga terkait"
        varchar(100) field_name "Nama kolom yang diusulkan diubah"
        text current_value "Nilai eksisting saat ini"
        text suggested_value "Nilai yang diusulkan"
        json suggested_geometry "Koordinat baru jika koreksi spasial"
        varchar(20) status "pending / approved / rejected"
        text reviewer_notes "Catatan dari admin verifikator"
    }
```

---

## 4. Alur Bisnis & Siklus Verifikasi (Verification State Machine)

Setiap entitas data lembaga memiliki siklus hidup verifikasi untuk menjamin akurasi dan akuntabilitas data spasial kelembagaan.

```mermaid
stateDiagram-v2
    [*] --> Valid: Data Master Awal (35.900+ Lembaga)

    Valid --> Pengajuan: Operator Lembaga memperbarui profil / polygon / child points
    Valid --> PendingEdits: Publik mengajukan usulan koreksi via Crowdsourcing

    state AdminReview {
        Pengajuan --> Valid: Admin menyetujui perubahan data
        Pengajuan --> Perbaikan: Admin menemukan kesalahan / data tidak sesuai
        Perbaikan --> Pengajuan: Operator memperbaiki dan mengajukan ulang
        PendingEdits --> Valid: Admin meng-approve suggested edit (otomatis update data)
        PendingEdits --> Rejected: Admin menolak suggested edit
    }

    Rejected --> [*]
```

### Penjelasan Status:
1. **`valid`**: Data telah diperiksa dan disetujui. Ditampilkan secara publik sebagai data resmi terverifikasi.
2. **`pengajuan`**: Pihak institusi baru saja menyimpan pembaruan profil atau batas polygon/fasilitas. Data ini muncul di daftar antrean verifikasi Admin di `/admin/institutions`.
3. **`perbaikan`**: Admin mengembalikan pengajuan dengan catatan perbaikan (misal: "Dokumen sertifikat belum jelas" atau "Batas polygon terpotong jalan umum").
4. **`suggested_edits` (`pending` -> `approved` / `rejected`)**: Usulan koreksi dari masyarakat yang diproses melalui sistem perbandingan *diff view*.

---

## 5. Arsitektur Keamanan & Otentikasi (Security Architecture)

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna / Operator
    participant Client as Next.js Client
    participant AuthRoute as /api/auth/login
    participant DB as PostgreSQL (users table)
    participant ProtectedRoute as Rute Terproteksi (/api/admin/*, /institusi/*)

    User->>Client: Input username & password
    Client->>AuthRoute: POST { username, password }
    AuthRoute->>DB: Query user by username
    DB-->>AuthRoute: User record (termasuk scrypt password hash)
    AuthRoute->>AuthRoute: Verifikasi verifyPassword(password, storedHash)
    alt Password Benar & is_active = true
        AuthRoute->>AuthRoute: Buat UserSession payload & tanda tangani token HMAC-SHA256
        AuthRoute-->>Client: Set Cookie: session_token (HttpOnly, Secure, SameSite=Lax)
        Client-->>User: Berhasil login -> Redirect sesuai role
    else Password Salah atau Akun Nonaktif
        AuthRoute-->>Client: HTTP 401 / 403 Forbidden
        Client-->>User: Tampilkan pesan kesalahan
    end

    User->>Client: Akses data/operasi terproteksi
    Client->>ProtectedRoute: HTTP Request (membawa cookie session_token)
    ProtectedRoute->>ProtectedRoute: getSessionUser(): Validasi signature HMAC timing-safe
    alt Token Valid & Role Diizinkan
        ProtectedRoute-->>Client: Return Data / Eksekusi Perubahan
    else Token Tidak Valid / Role Tidak Sesuai
        ProtectedRoute-->>Client: HTTP 401 / 403
    end
```

### Komponen Pengamanan Kunci:
1. **Hashing Password**: Menggunakan `crypto.scryptSync` dengan salt 16-byte acak dan panjang output 64-byte. Format penyimpanan: `<salt>:<hash>`.
2. **Mencegah Timing Attacks**: Pengujian kecocokan hash dan token signature menggunakan `crypto.timingSafeEqual` untuk mencegah kebocoran informasi melalui perbedaan waktu komputasi CPU.
3. **Penyimpanan Token Sesi**: Disimpan pada cookie HTTP yang aman dengan flag `SameSite=Lax` dan masa berlaku 7 hari.

---

## 6. Taksonomi Endpoint API (API Specification Matrix)

| Endpoint | Method | Autentikasi / Izin | Deskripsi & Tujuan |
| :--- | :---: | :--- | :--- |
| `/api/institutions/map` | `GET` | Publik | Payload ringan marker peta se-Indonesia (<300ms) dengan filter provinsi, tipe, status, jenjang. |
| `/api/institutions/polygons` | `GET` | Publik | Mengambil data poligon koordinat lahan institusi untuk dirender di atas peta Leaflet. |
| `/api/institutions/[id]` | `GET` | Publik | Profil detail lengkap institusi termasuk fasilitas, tanah, dan child points. |
| `/api/institutions/[id]/child-points` | `GET` | Publik | Daftar titik fasilitas gedung di dalam institusi. |
| `/api/institutions/[id]/child-points` | `POST` | Admin / Institusi Pemilik | Menambahkan titik fasilitas baru dengan validasi point-in-polygon wajib. |
| `/api/institutions/[id]/child-points/[pointId]` | `PATCH` | Admin / Institusi Pemilik | Mengubah atribut atau koordinat titik fasilitas. |
| `/api/institutions/[id]/child-points/[pointId]` | `DELETE` | Admin / Institusi Pemilik | Menghapus titik fasilitas gedung. |
| `/api/stats` | `GET` | Publik | Ringkasan statistik nasional: total lembaga, proporsi tipe, top provinsi. |
| `/api/provinces` | `GET` | Publik | Daftar provinsi unik dan jumlah lembaga per provinsi. |
| `/api/suggest-edit` | `POST` | Publik | Mengirim usulan koreksi data oleh masyarakat. |
| `/api/auth/login` | `POST` | Publik | Otentikasi multi-peran (Admin & Institusi). |
| `/api/auth/logout` | `POST` | Terautentikasi | Mengosongkan sesi cookie. |
| `/api/auth/me` | `GET` | Terautentikasi | Informasi identitas user aktif dan hak aksesnya. |
| `/api/institusi/me` | `GET` | Role `institusi` | Profil lembaga khusus milik institusi yang sedang login. |
| `/api/admin/institutions` | `GET` | Role `admin`, `super_admin` | Daftar institusi dengan filter status verifikasi (`valid`, `pengajuan`, `perbaikan`). |
| `/api/admin/institutions/[id]/status` | `PATCH` | Role `admin`, `super_admin` | Mengubah status verifikasi lembaga. |
| `/api/admin/edits` | `GET` | Role `admin`, `super_admin` | Daftar usulan crowdsource publik pending/approved/rejected. |
| `/api/admin/edits/[id]/approve` | `POST` | Role `admin`, `super_admin` | Menyetujui usulan koreksi dan mengaplikasikannya ke database. |
| `/api/admin/edits/[id]/reject` | `POST` | Role `admin`, `super_admin` | Menolak usulan koreksi dengan catatan reviewer. |
| `/api/admin/users` | `GET`, `POST` | Role `super_admin` | Manajemen akun pengguna (35.904 akun). |

---

## 7. Karakteristik Runtime & Kinerja (Runtime & Production Performance)

- **Next.js Turbopack & App Router**: Kompilasi aset dan rute super cepat.
- **Partial Prerendering (PPR)**: Halaman detail `/institutions/[id]` merender layout statis secara instan dan mengalirkan data dinamis (*streaming*) di background.
- **Neon Cloud Postgres Connection Pooler**: Menggunakan endpoint pooler (`-pooler`) untuk mencegah batas koneksi habis saat lalu lintas tinggi.
- **Keamanan Dependensi**: Next.js telah ditingkatkan ke **16.4.3** dengan konfigurasi `experimental.agentUpgrade = "security"` untuk menjamin keamanan dari kerentanan advisory terbaru.
