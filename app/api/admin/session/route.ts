import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  return NextResponse.json({ authenticated: token === "authenticated" });
}
