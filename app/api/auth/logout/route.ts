import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ status: "ok", message: "Logged out successfully" });
  
  // Hapus cookie auth_session dan admin_session dengan path root
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
