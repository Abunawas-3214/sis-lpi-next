import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions, suggestedEdits, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Sesi login berakhir" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let targetInstId = currentUser.institutionId;

    // Admins can view specific institution
    if (
      (currentUser.role === "super_admin" || currentUser.role === "admin") &&
      searchParams.get("id")
    ) {
      targetInstId = searchParams.get("id");
    }

    if (!targetInstId) {
      return NextResponse.json(
        { error: "Akun ini tidak tertaut ke institusi manapun" },
        { status: 404 }
      );
    }

    const [inst] = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, targetInstId))
      .limit(1);

    if (!inst) {
      return NextResponse.json(
        { error: "Data institusi tidak ditemukan" },
        { status: 404 }
      );
    }

    // Pending edits for this institution
    const pending = await db
      .select()
      .from(suggestedEdits)
      .where(
        sql`${suggestedEdits.institutionId} = ${targetInstId} AND ${suggestedEdits.status} = 'pending'`
      );

    return NextResponse.json({
      institution: inst,
      pendingEdits: pending,
      user: currentUser,
    });
  } catch (error: any) {
    console.error("Error fetching institution me:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) {
    return NextResponse.json({ error: "Sesi login berakhir" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let targetInstId = currentUser.institutionId;

    if (
      (currentUser.role === "super_admin" || currentUser.role === "admin") &&
      searchParams.get("id")
    ) {
      targetInstId = searchParams.get("id");
    }

    if (!targetInstId) {
      return NextResponse.json(
        { error: "Akun ini tidak tertaut ke institusi manapun" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // 1. Fetch current institution data
    const [currentInst] = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, targetInstId))
      .limit(1);

    if (!currentInst) {
      return NextResponse.json(
        { error: "Data institusi tidak ditemukan" },
        { status: 404 }
      );
    }

    const batchId = crypto.randomUUID();

    // 2. Prepare update data
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      // Status becomes 'pengajuan' whenever edited by institution
      verificationStatus: "pengajuan",
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.level !== undefined) updateData.level = body.level;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.province !== undefined) updateData.province = body.province;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.accreditation !== undefined) updateData.accreditation = body.accreditation;
    if (body.landTotalAreaM2 !== undefined) {
      updateData.landTotalAreaM2 = body.landTotalAreaM2
        ? parseFloat(body.landTotalAreaM2)
        : null;
    }
    if (body.landCertificateStatus !== undefined) {
      updateData.landCertificateStatus = body.landCertificateStatus;
    }
    if (body.landCertificateNumber !== undefined) {
      updateData.landCertificateNumber = body.landCertificateNumber;
    }
    if (body.landUseCategories !== undefined) {
      updateData.landUseCategories = body.landUseCategories;
    }
    if (body.landNjop !== undefined) updateData.landNjop = body.landNjop;
    if (body.landPricePerM2 !== undefined) {
      updateData.landPricePerM2 = body.landPricePerM2;
    }
    if (body.landEstimatedTotalValue !== undefined) {
      updateData.landEstimatedTotalValue = body.landEstimatedTotalValue;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Polygon coordinates update
    if (body.landGeometry !== undefined) {
      updateData.landGeometry = body.landGeometry;
    }
    if (body.landParcels !== undefined) {
      updateData.landParcels = body.landParcels;
    }

    if (body.latitude !== undefined && body.longitude !== undefined) {
      const lat = body.latitude ? parseFloat(body.latitude) : null;
      const lng = body.longitude ? parseFloat(body.longitude) : null;
      updateData.latitude = lat;
      updateData.longitude = lng;
      if (lat !== null && lng !== null) {
        updateData.coordinatePrecision = "exact";
        updateData.geom = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
      }
    }

    // Apply the updates to institution
    await db
      .update(institutions)
      .set(updateData)
      .where(eq(institutions.id, targetInstId));

    // 3. Record in suggested_edits for audit trail & admin review
    await db.insert(suggestedEdits).values({
      batchId,
      institutionId: targetInstId,
      institutionName: updateData.name || currentInst.name,
      actionType: "update",
      fieldName: "pengajuan_data_dan_polygon",
      currentValue: JSON.stringify({
        notes: currentInst.notes,
        landTotalAreaM2: currentInst.landTotalAreaM2,
        hasPolygon: Boolean(currentInst.landGeometry),
      }),
      suggestedValue: JSON.stringify({
        notes: updateData.notes,
        landTotalAreaM2: updateData.landTotalAreaM2,
        hasPolygon: Boolean(updateData.landGeometry),
        parcelsCount: Array.isArray(updateData.landParcels) ? updateData.landParcels.length : 0,
      }),
      suggestedGeometry: updateData.landGeometry || null,
      suggestedPayload: {
        ...updateData,
        submittedAt: new Date().toISOString(),
      },
      submitterName: currentUser.name,
      submitterRole: "Institusi",
      submitterEmail: currentUser.username,
      status: "pending",
      createdAt: new Date(),
    });

    return NextResponse.json({
      message:
        "Perubahan data dan polygon berhasil diajukan. Status institusi kini 'Pengajuan' dan menunggu verifikasi Admin.",
      verificationStatus: "pengajuan",
      batchId,
    });
  } catch (error: any) {
    console.error("Error updating institution me:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
