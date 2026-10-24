import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { institutions, users, suggestedEdits } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSessionUser, hashPassword } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getSessionUser(request);
  const legacyToken = request.cookies.get("admin_session")?.value;
  const isAuth =
    (currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin")) ||
    legacyToken === "authenticated";

  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const [inst] = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, id))
      .limit(1);

    if (!inst) {
      return NextResponse.json({ error: "Institusi tidak ditemukan" }, { status: 404 });
    }

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        email: users.email,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.institutionId, id))
      .limit(1);

    // Also get any pending edits for this institution
    const pendingEdits = await db
      .select()
      .from(suggestedEdits)
      .where(sql`${suggestedEdits.institutionId} = ${id} AND ${suggestedEdits.status} = 'pending'`);

    return NextResponse.json({
      institution: inst,
      user: user || null,
      pendingEdits,
    });
  } catch (error: any) {
    console.error("Error fetching institution:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getSessionUser(request);
  const legacyToken = request.cookies.get("admin_session")?.value;
  const isAuth =
    (currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin")) ||
    legacyToken === "authenticated";

  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.level !== undefined) updateData.level = body.level;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.province !== undefined) updateData.province = body.province;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.verificationStatus !== undefined) updateData.verificationStatus = body.verificationStatus;
    if (body.accreditation !== undefined) updateData.accreditation = body.accreditation;
    if (body.landTotalAreaM2 !== undefined) {
      updateData.landTotalAreaM2 = body.landTotalAreaM2 ? parseFloat(body.landTotalAreaM2) : null;
    }
    if (body.landCertificateStatus !== undefined) updateData.landCertificateStatus = body.landCertificateStatus;
    if (body.landCertificateNumber !== undefined) updateData.landCertificateNumber = body.landCertificateNumber;
    if (body.landUseCategories !== undefined) updateData.landUseCategories = body.landUseCategories;
    if (body.landNjop !== undefined) updateData.landNjop = body.landNjop;
    if (body.landPricePerM2 !== undefined) updateData.landPricePerM2 = body.landPricePerM2;
    if (body.landEstimatedTotalValue !== undefined) updateData.landEstimatedTotalValue = body.landEstimatedTotalValue;
    if (body.notes !== undefined) updateData.notes = body.notes;

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

    await db.update(institutions).set(updateData).where(eq(institutions.id, id));

    // If user password reset was requested
    if (body.userPassword) {
      const hashed = hashPassword(body.userPassword);
      await db
        .update(users)
        .set({ password: hashed, updatedAt: new Date() })
        .where(eq(users.institutionId, id));
    }

    // If institution name changed, update user's display name too
    if (body.name) {
      await db
        .update(users)
        .set({ name: body.name, updatedAt: new Date() })
        .where(eq(users.institutionId, id));
    }

    return NextResponse.json({ message: "Data institusi berhasil diperbarui" });
  } catch (error: any) {
    console.error("Error updating institution:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getSessionUser(request);
  const legacyToken = request.cookies.get("admin_session")?.value;
  const isAuth =
    (currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin")) ||
    legacyToken === "authenticated";

  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Delete user account first
    await db.delete(users).where(eq(users.institutionId, id));

    // Delete suggested edits
    await db.delete(suggestedEdits).where(eq(suggestedEdits.institutionId, id));

    // Delete institution
    await db.delete(institutions).where(eq(institutions.id, id));

    return NextResponse.json({ message: "Institusi berhasil dihapus" });
  } catch (error: any) {
    console.error("Error deleting institution:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
