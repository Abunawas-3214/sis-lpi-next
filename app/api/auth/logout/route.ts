import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ status: "ok" });
  response.cookies.delete("auth_session");
  response.cookies.delete("admin_session");
  return response;
}
