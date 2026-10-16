import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const expectedPassword = process.env.ADMIN_PASSWORD || "sis-lpi-admin-2026";

    if (!data?.password || data.password !== expectedPassword) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }

    const response = NextResponse.json({ status: "ok" });
    response.cookies.set("admin_session", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
