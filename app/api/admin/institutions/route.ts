import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions, users } from "@/lib/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getSessionUser, hashPassword } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const currentUser = await getSessionUser(request);
  const legacyToken = request.cookies.get("admin_session")?.value;
  const isAuth =
    (currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin")) ||
    legacyToken === "authenticated";

  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get("limit") || "15")));
    const q = searchParams.get("q")?.trim() || "";
    const type = searchParams.get("type") || "";
    const province = searchParams.get("province") || "";
    const verificationStatus = searchParams.get("verification_status") || "";

    const offset = (page - 1) * limit;

    const conditions = [];

    if (q) {
      conditions.push(
        or(
          ilike(institutions.name, `%${q}%`),
          ilike(institutions.id, `%${q}%`),
          ilike(institutions.city, `%${q}%`),
          ilike(institutions.province, `%${q}%`)
        )
      );
    }

    if (type && type !== "all") {
      conditions.push(eq(institutions.type, type));
    }

    if (province && province !== "all") {
      conditions.push(eq(institutions.province, province));
    }

    if (verificationStatus && verificationStatus !== "all") {
      conditions.push(eq(institutions.verificationStatus, verificationStatus));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total rows
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(institutions)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    // Fetch paginated data
    const rows = await db
      .select({
        id: institutions.id,
        name: institutions.name,
        type: institutions.type,
        level: institutions.level,
        status: institutions.status,
        address: institutions.address,
        province: institutions.province,
        city: institutions.city,
        latitude: institutions.latitude,
        longitude: institutions.longitude,
        landTotalAreaM2: institutions.landTotalAreaM2,
        landCertificateStatus: institutions.landCertificateStatus,
        verificationStatus: institutions.verificationStatus,
        updatedAt: institutions.updatedAt,
        hasPolygon: sql<boolean>`CASE WHEN ${institutions.landGeometry} IS NOT NULL AND json_array_length(CASE WHEN json_typeof(${institutions.landGeometry}) = 'array' THEN ${institutions.landGeometry} ELSE '[]'::json END) > 2 THEN true ELSE false END`,
        hasParcels: sql<boolean>`CASE WHEN ${institutions.landParcels} IS NOT NULL AND json_array_length(CASE WHEN json_typeof(${institutions.landParcels}) = 'array' THEN ${institutions.landParcels} ELSE '[]'::json END) > 0 THEN true ELSE false END`,
      })
      .from(institutions)
      .where(whereClause)
      .orderBy(
        // Prioritize 'pengajuan' so admin sees pending verification first
        sql`CASE WHEN ${institutions.verificationStatus} = 'pengajuan' THEN 1 WHEN ${institutions.verificationStatus} = 'tidak_valid' THEN 2 ELSE 3 END`,
        desc(institutions.updatedAt)
      )
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Error fetching institutions:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const currentUser = await getSessionUser(request);
  const legacyToken = request.cookies.get("admin_session")?.value;
  const isAuth =
    (currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin")) ||
    legacyToken === "authenticated";

  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      type,
      level,
      status,
      address,
      province,
      city,
      latitude,
      longitude,
      landTotalAreaM2,
      landCertificateStatus,
      landCertificateNumber,
      notes,
      initialPassword,
    } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Nama institusi dan tipe lembaga wajib diisi" },
        { status: 400 }
      );
    }

    // Generate clean 5-digit or 6-digit ID
    let newId = body.id?.trim();
    if (!newId) {
      const maxRes = await db.execute(
        sql`SELECT id FROM institutions WHERE id ~ '^[0-9]+$' ORDER BY CAST(id AS INTEGER) DESC LIMIT 1`
      );
      const maxRow = maxRes.rows[0];
      if (maxRow && (maxRow as any).id) {
        const nextNum = parseInt((maxRow as any).id, 10) + 1;
        newId = String(nextNum).padStart(5, "0");
      } else {
        newId = Math.floor(10000 + Math.random() * 90000).toString();
      }
    }

    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;

    // Insert institution
    await db.insert(institutions).values({
      id: newId,
      name: name.trim(),
      type: type || "pesantren",
      level: level || "menengah",
      status: status || "swasta",
      address: address ? address.trim() : null,
      province: province || null,
      city: city || null,
      latitude: lat,
      longitude: lng,
      coordinatePrecision: lat && lng ? "exact" : null,
      geom:
        lat !== null && lng !== null
          ? sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`
          : null,
      landTotalAreaM2: landTotalAreaM2 ? parseFloat(landTotalAreaM2) : null,
      landCertificateStatus: landCertificateStatus || null,
      landCertificateNumber: landCertificateNumber || null,
      notes: notes || "",
      verificationStatus: "valid",
      source: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create corresponding user account for this institution
    const userPassword = initialPassword || "institusi123";
    const hashed = hashPassword(userPassword);

    await db.insert(users).values({
      username: newId,
      password: hashed,
      name: name.trim(),
      role: "institusi",
      institutionId: newId,
      isActive: "true",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      message: "Institusi dan akun pengguna berhasil dibuat",
      institutionId: newId,
      username: newId,
      defaultPassword: userPassword,
    });
  } catch (error: any) {
    console.error("Error creating institution:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
