import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    // Ambil data terbaru dari database
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        institutionId: users.institutionId,
        email: users.email,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        institutionId: user.institutionId,
        email: user.email || null,
        isActive: user.isActive,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error checking session: " + error.message },
      { status: 500 }
    );
  }
}
