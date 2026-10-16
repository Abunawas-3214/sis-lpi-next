import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions } from "@/lib/db/schema";
import { and, count, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { SEARCH_ALIASES } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get("province");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const level = searchParams.get("level");
    const accreditation = searchParams.get("accreditation");
    const searchRaw = searchParams.get("search")?.trim().toLowerCase();

    const conditions = [];

    if (province) conditions.push(eq(institutions.province, province));
    if (type) conditions.push(eq(institutions.type, type));
    if (status) conditions.push(eq(institutions.status, status));
    if (level) conditions.push(eq(institutions.level, level));
    if (accreditation) {
      if (accreditation === "terakreditasi") {
        conditions.push(ilike(institutions.accreditation, "%terakreditasi%"));
      } else if (accreditation === "belum") {
        conditions.push(ilike(institutions.accreditation, "%belum%"));
      } else {
        conditions.push(ilike(institutions.accreditation, `%${accreditation}%`));
      }
    }

    if (searchRaw) {
      const searchTerms = [searchRaw];
      if (SEARCH_ALIASES[searchRaw]) searchTerms.push(...SEARCH_ALIASES[searchRaw]);
      const orClauses = searchTerms.flatMap((term) => [
        ilike(institutions.name, `%${term}%`),
        ilike(institutions.city, `%${term}%`),
        ilike(institutions.address, `%${term}%`),
      ]);
      conditions.push(or(...orClauses)!);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count
    const [totalRow] = await db
      .select({ val: count() })
      .from(institutions)
      .where(whereClause);
    const total = totalRow?.val || 0;

    // By type
    const byTypeRows = await db
      .select({
        key: institutions.type,
        val: count(),
      })
      .from(institutions)
      .where(whereClause)
      .groupBy(institutions.type);
    const by_type: Record<string, number> = {};
    byTypeRows.forEach((r) => {
      by_type[r.key || "unknown"] = r.val;
    });

    // By status
    const byStatusRows = await db
      .select({
        key: institutions.status,
        val: count(),
      })
      .from(institutions)
      .where(whereClause)
      .groupBy(institutions.status);
    const by_status: Record<string, number> = {};
    byStatusRows.forEach((r) => {
      by_status[r.key || "unknown"] = r.val;
    });

    // Top 10 provinces
    const topProvRows = await db
      .select({
        key: institutions.province,
        val: count(),
      })
      .from(institutions)
      .where(and(isNotNull(institutions.province), whereClause))
      .groupBy(institutions.province)
      .orderBy(desc(count()))
      .limit(10);
    const by_province_top10: Record<string, number> = {};
    topProvRows.forEach((r) => {
      if (r.key) by_province_top10[r.key] = r.val;
    });

    // Precision
    const precRows = await db
      .select({
        key: institutions.coordinatePrecision,
        val: count(),
      })
      .from(institutions)
      .where(whereClause)
      .groupBy(institutions.coordinatePrecision);
    const by_precision: Record<string, number> = {};
    precRows.forEach((r) => {
      by_precision[r.key || "unknown"] = r.val;
    });

    return NextResponse.json({
      total,
      by_type,
      by_status,
      by_province_top10,
      by_precision,
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats", details: error.message },
      { status: 500 }
    );
  }
}
