import "dotenv/config";
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Creating institution_child_points table...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS institution_child_points (
      id SERIAL PRIMARY KEY,
      institution_id VARCHAR(10) NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
      polygon_id VARCHAR(100),
      polygon_name VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) DEFAULT 'gedung',
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      custom_variables JSON,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_child_points_inst_id ON institution_child_points(institution_id);
    CREATE INDEX IF NOT EXISTS idx_child_points_polygon_id ON institution_child_points(polygon_id);
  `);

  console.log("institution_child_points table ensured.");

  // Also check if UIN Malang 01375 can have some demo child points from its KML if empty
  const count = await db.execute(sql`SELECT count(*) FROM institution_child_points WHERE institution_id = '01375'`);
  if (Number(count.rows[0]?.count || 0) === 0) {
    console.log("Seeding initial child points for UIN Malang (01375)...");
    await db.execute(sql`
      INSERT INTO institution_child_points (institution_id, polygon_id, polygon_name, name, category, latitude, longitude, custom_variables, notes)
      VALUES 
        ('01375', 'poly-1', 'Kampus 1 (Utama)', 'Gedung Rektorat Ir. (HC) Soekarno', 'perkantoran', -7.95156, 112.60742, '{"luas_lantai_m2": "3200", "jumlah_lantai": "5", "tahun_pembangunan": "2008"}'::json, 'Pusat administrasi universitas'),
        ('01375', 'poly-1', 'Kampus 1 (Utama)', 'Masjid Tarbiyah / Ulul Albab', 'ibadah', -7.95215, 112.60751, '{"kapasitas_jamaah": "2500", "luas_bangunan_m2": "1800"}'::json, 'Masjid utama kampus UIN Malang'),
        ('01375', 'poly-1', 'Kampus 1 (Utama)', 'Gedung Perpustakaan Pusat', 'pendidikan', -7.95060, 112.60797, '{"koleksi_buku": "120000", "ruang_baca": "Ada"}'::json, 'Perpustakaan pusat berlantai 4')
      ON CONFLICT DO NOTHING;
    `);
    console.log("Demo child points seeded for 01375.");
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
