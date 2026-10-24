import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, or, sql } from "drizzle-orm";
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
    const adminUsers = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(or(eq(users.role, "super_admin"), eq(users.role, "admin")))
      .orderBy(sql`${users.createdAt} ASC`);

    return NextResponse.json({ data: adminUsers });
  } catch (error: any) {
    console.error("Error fetching admin users:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const currentUser = await getSessionUser(request);
  const legacyToken = request.cookies.get("admin_session")?.value;
  
  // Only super_admin (or legacy token for bootstrapping) can add admins
  const isSuper =
    (currentUser && currentUser.role === "super_admin") ||
    legacyToken === "authenticated";

  if (!isSuper) {
    return NextResponse.json(
      { error: "Hanya Super Admin yang dapat menambahkan Admin baru" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { username, password, name, email } = body;

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "Username, password, dan nama wajib diisi" },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Check if username already exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.username, trimmedUsername))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Username sudah digunakan" },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        username: trimmedUsername,
        password: hashedPassword,
        name: name.trim(),
        role: "admin",
        email: email ? email.trim() : null,
        isActive: "true",
      })
      .returning({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        email: users.email,
        createdAt: users.createdAt,
      });

    return NextResponse.json({
      message: "Admin baru berhasil ditambahkan",
      user: newUser,
    });
  } catch (error: any) {
    console.error("Error creating admin user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
