import "dotenv/config";
import { db } from "../lib/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function run() {
  console.log("Starting migration...");
  try {
    // 1. Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        institution_id VARCHAR(10),
        email VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_institution_id ON users(institution_id);
    `);
    console.log("Users table ensured.");

    // 2. Add verification_status to institutions
    await db.execute(sql`
      ALTER TABLE institutions 
      ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'valid';
      CREATE INDEX IF NOT EXISTS idx_institutions_verification_status ON institutions(verification_status);
    `);
    console.log("Institutions verification_status column ensured.");

    // 3. Create default Super Admin
    const superAdminPassword = hashPassword("superadmin123");
    await db.execute(sql`
      INSERT INTO users (username, password, name, role, email, is_active)
      VALUES ('superadmin', ${superAdminPassword}, 'Super Administrator', 'super_admin', 'superadmin@sis-lpi.id', TRUE)
      ON CONFLICT (username) DO NOTHING;
    `);
    console.log("Super Admin ensured: username 'superadmin', password 'superadmin123'");

    // 4. Create default Admin
    const adminPassword = hashPassword("admin123");
    await db.execute(sql`
      INSERT INTO users (username, password, name, role, email, is_active)
      VALUES ('admin', ${adminPassword}, 'Administrator', 'admin', 'admin@sis-lpi.id', TRUE)
      ON CONFLICT (username) DO NOTHING;
    `);
    console.log("Admin ensured: username 'admin', password 'admin123'");

    // 5. Populate institution users
    console.log("Populating users for each institution in institutions table...");
    const defaultInstPassword = hashPassword("institusi123");

    // Insert all institutions as users where username = institution id
    const res = await db.execute(sql`
      INSERT INTO users (username, password, name, role, institution_id, is_active, created_at, updated_at)
      SELECT 
        i.id AS username,
        ${defaultInstPassword} AS password,
        i.name AS name,
        'institusi' AS role,
        i.id AS institution_id,
        TRUE AS is_active,
        NOW() AS created_at,
        NOW() AS updated_at
      FROM institutions i
      ON CONFLICT (username) DO UPDATE 
        SET institution_id = EXCLUDED.institution_id,
            name = EXCLUDED.name;
    `);

    const userCount = await db.execute(sql`SELECT count(*) FROM users`);
    const instUserCount = await db.execute(sql`SELECT count(*) FROM users WHERE role = 'institusi'`);
    console.log("Migration completed!");
    console.log("Total users:", userCount.rows[0]);
    console.log("Total institution users:", instUserCount.rows[0]);

    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

run();
