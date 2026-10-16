import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ status: "ok" });
  response.cookies.delete("admin_session");
  return response;
}
