import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, signToken, UserSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { username, password } = data;

    // 1. If username is provided, authenticate against users table
    if (username) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username.trim()))
        .limit(1);

      if (!user) {
        return NextResponse.json({ error: "Akun admin tidak ditemukan" }, { status: 401 });
      }

      if (user.role !== "super_admin" && user.role !== "admin") {
        return NextResponse.json({ error: "Akun ini tidak memiliki akses ke panel admin" }, { status: 403 });
      }

      const isValid = verifyPassword(password, user.password);
      if (!isValid) {
        return NextResponse.json({ error: "Password salah" }, { status: 401 });
      }

      const session: UserSession = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role as "super_admin" | "admin",
        institutionId: user.institutionId,
      };

      const token = signToken(session);
      const response = NextResponse.json({ status: "ok", user: session });

      response.cookies.set("auth_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      response.cookies.set("admin_session", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return response;
    }

    // 2. Legacy password fallback
    const expectedPassword = process.env.ADMIN_PASSWORD || "sis-lpi-admin-2026";
    if (!password || password !== expectedPassword) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }

    const legacySession: UserSession = {
      id: 0,
      username: "admin",
      name: "Administrator",
      role: "admin",
      institutionId: null,
    };

    const token = signToken(legacySession);
    const response = NextResponse.json({ status: "ok", user: legacySession });

    response.cookies.set("auth_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    response.cookies.set("admin_session", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
