import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ status: "ok", message: "Admin logged out successfully" });
  
  // Hapus semua cookie sesi
  response.cookies.set("auth_session", "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
  });
  response.cookies.set("admin_session", "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
  });
  response.cookies.delete("auth_session");
  response.cookies.delete("admin_session");

  return response;
}
