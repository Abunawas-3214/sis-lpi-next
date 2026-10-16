<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Development & Architecture Guide for SIS-LPI Next

Selamat datang di proyek **SIS-LPI Next** (Sistem Informasi Spasial Lembaga Pendidikan Islam berbasis Next.js 16 + Drizzle ORM). File ini adalah instruksi operasional untuk AI agent dan developer.

---

## 1. Project Overview & Scope
- **Core Mission**: Menyediakan peta Web GIS interaktif berkinerja tinggi untuk memetakan 35.000+ lembaga pendidikan Islam (Pesantren, Madrasah, PTKI) di Indonesia beserta batas poligon lahan wakaf/aset dan data legalitas.
- **Tech Stack**:
  - **Framework**: Next.js 16.4 (App Router)
  - **UI / Library**: React 19.3, Tailwind CSS v4, Lucide React
  - **GIS**: Leaflet 1.9 + Marker Clustering (OpenStreetMap, Carto, Esri Satellite)
  - **Database & ORM**: PostgreSQL with PostGIS, Drizzle ORM (`drizzle-orm`, `drizzle-kit`), driver `pg`
  - **Runtime & Package Manager**: Bun (atau npm/pnpm)

---

## 2. Directory Structure Conventions
```
sis-lpi-next/
├── app/
│   ├── api/                     # Next.js Route Handlers (REST Endpoints)
│   │   ├── institutions/
│   │   │   ├── map/route.ts     # Lightweight marker API
│   │   │   └── [id]/route.ts    # Full detail API
│   │   ├── stats/route.ts       # Aggregated stats API
│   │   ├── provinces/route.ts   # Distinct provinces API
│   │   ├── suggest-edit/route.ts# Crowdsourced edits submission
│   │   └── admin/               # Admin authentication & review routes
│   ├── institutions/
│   │   └── [id]/page.tsx        # Dedicated full-page institution detail
│   ├── admin/
│   │   └── page.tsx             # Dedicated Admin verification panel
│   ├── layout.tsx               # Root layout & font configurations
│   ├── globals.css              # Tailwind CSS v4 directives & theme variables
│   └── page.tsx                 # Main Interactive Web GIS Dashboard
├── components/
│   ├── map/                     # Leaflet dynamic map components
│   │   ├── MapContainer.tsx
│   │   ├── MarkerCluster.tsx
│   │   └── PolygonLayer.tsx
│   ├── sidebar/                 # Search, filtering, and layers controls
│   ├── detail/                  # Institution detail drawer & modals
│   └── admin/                   # Admin diff viewer & approval actions
├── lib/
│   ├── db/
│   │   ├── index.ts             # Drizzle database client instance (pg pool)
│   │   └── schema.ts            # Drizzle table schemas (institutions, suggestedEdits)
│   └── utils.ts                 # Helper functions (formatting, search aliases)
├── drizzle/                     # Drizzle migration files and snapshots
├── PRD.md                       # Product Requirements Document
├── Design.md                    # System Architecture & Design Specification
├── AGENTS.md                    # This guide
├── .env                         # PostgreSQL DATABASE_URL connection string
└── package.json
```

---

## 3. Database & Drizzle ORM Guidelines
1. **Koneksi Database**:
   - Selalu gunakan `process.env.DATABASE_URL` dari `.env`.
   - Gunakan instance `db` dari `@/lib/db`.
2. **Schema Tables**:
   - `institutions`: Menyimpan 35.000+ data lembaga. Kolom spasial `geom` bertipe PostGIS geometry.
   - `suggestedEdits`: Menyimpan riwayat usulan perubahan data dan pendaftaran lembaga baru.
3. **Optimasi Kueri Spasial**:
   - Untuk endpoint peta `/api/institutions/map`, pilih hanya field esensial (`id`, `name`, `type`, `level`, `status`, `province`, `city`, `latitude`, `longitude`, `accreditation`, `has_polygon`).
   - Jangan melakukan `select *` pada 35.000 row sekaligus jika tidak diperlukan untuk mencegah overhead memori.

---

## 4. Coding & Component Conventions
- **React 19 & Next.js 16**:
  - Komponen peta (Leaflet) wajib di-load secara dinamis dengan `{ ssr: false }` karena Leaflet membutuhkan objek `window`.
  - Gunakan Server Components untuk fetching data awal jika memungkinkan, dan Client Components (`"use client"`) untuk interaktivitas peta dan filter.
- **Styling**:
  - Gunakan class utilitas Tailwind CSS v4.
  - Skema warna:
    - Pesantren: Emerald (`#059669`)
    - Madrasah: Amber (`#d97706`)
    - Universitas Islam: Indigo (`#4f46e5`)
    - Netral: Zinc / Slate.

---

## 5. Development Commands
- **Menjalankan dev server**: `bun dev` (atau `npm run dev`)
- **Build production**: `bun run build`
- **Drizzle Studio (Database viewer GUI)**: `bun x drizzle-kit studio`
- **Introspeksi Database**: `bun x drizzle-kit introspect`
