import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (user && (user.role === "super_admin" || user.role === "admin")) {
    return NextResponse.json({ authenticated: true, user });
  }

  const legacy = request.cookies.get("admin_session")?.value;
  if (legacy === "authenticated") {
    return NextResponse.json({
      authenticated: true,
      user: {
        id: 0,
        username: "admin",
        name: "Administrator",
        role: "admin",
        institutionId: null,
      },
    });
  }

  return NextResponse.json({ authenticated: false, user: null });
}
