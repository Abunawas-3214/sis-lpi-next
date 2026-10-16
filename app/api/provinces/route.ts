import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { isNotNull, sql } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        province: institutions.province,
      })
      .from(institutions)
      .where(isNotNull(institutions.province))
      .groupBy(institutions.province)
      .orderBy(institutions.province);

    const provinces = rows
      .map((r) => r.province)
      .filter((p): p is string => Boolean(p));

    return NextResponse.json(provinces);
  } catch (error: any) {
    console.error("Error fetching provinces:", error);
    return NextResponse.json(
      { error: "Failed to fetch provinces", details: error.message },
      { status: 500 }
    );
  }
}
