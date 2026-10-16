import { db } from "@/lib/db";
import { institutions, suggestedEdits, SuggestedEdit } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function applySuggestedEdit(edit: SuggestedEdit) {
  const actionType = edit.actionType || "update";

  if (actionType === "create") {
    let payload = edit.suggestedPayload as any;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }
    if (!payload) throw new Error("Missing suggested_payload for create action");

    const suggestedCoords = edit.suggestedGeometry as any;
    let coordinates: [number, number] | null = null;
    if (
      suggestedCoords &&
      Array.isArray(suggestedCoords) &&
      suggestedCoords.length === 2
    ) {
      coordinates = [parseFloat(suggestedCoords[0]), parseFloat(suggestedCoords[1])];
    } else if (
      payload.coordinates &&
      Array.isArray(payload.coordinates) &&
      payload.coordinates.length === 2
    ) {
      coordinates = [parseFloat(payload.coordinates[0]), parseFloat(payload.coordinates[1])];
    }

    const newId =
      payload.id ||
      payload.nomor_data_lembaga ||
      crypto.randomUUID().replace(/-/g, "").slice(0, 10);

    const lat = coordinates ? coordinates[0] : null;
    const lng = coordinates ? coordinates[1] : null;

    await db.insert(institutions).values({
      id: String(newId).slice(0, 10),
      name: payload.name || "Unknown",
      type: payload.type || "unknown",
      level: payload.level || "unknown",
      status: payload.status || "unknown",
      address: payload.address || null,
      province: payload.province || null,
      city: payload.city || null,
      coordinatePrecision: coordinates ? "exact" : null,
      latitude: lat,
      longitude: lng,
      geom:
        lat !== null && lng !== null
          ? sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`
          : null,
      landTotalAreaM2: payload.land_total_area_m2 ? parseFloat(payload.land_total_area_m2) : null,
      landOwnership: payload.land_ownership || null,
      landSource: payload.land_source || null,
      landGeometry: payload.land_geometry || null,
      landParcels: payload.land_parcels || null,
      landCertificateStatus: payload.land_certificate_status || null,
      landCertificateNumber: payload.land_certificate_number || null,
      landUseCategories: payload.land_use_categories || null,
      landUseEducation: payload.land_use_education || null,
      landUseDormitory: payload.land_use_dormitory || null,
      landUseEconomic: payload.land_use_economic || null,
      landUseAgriculture: payload.land_use_agriculture || null,
      landUseWorship: payload.land_use_worship || null,
      landUseOther: payload.land_use_other || null,
      landNjop: payload.land_njop || null,
      landPricePerM2: payload.land_price_per_m2 || null,
      landEstimatedTotalValue: payload.land_estimated_total_value || null,
      landValuationYear: payload.land_valuation_year || null,
      accreditation: payload.accreditation || null,
      emisCategory: payload.emis_category || null,
      osmTags: payload.osm_tags || {},
      source: payload.source || "manual",
      notes: payload.notes || "",
    });

    return newId;
  }

  if (actionType === "delete") {
    if (!edit.institutionId) throw new Error("Institution ID is required for delete");
    await db.delete(institutions).where(eq(institutions.id, edit.institutionId));
    return edit.institutionId;
  }

  if (!edit.institutionId) throw new Error("Institution ID is required");

  const [inst] = await db
    .select()
    .from(institutions)
    .where(eq(institutions.id, edit.institutionId))
    .limit(1);

  if (!inst) throw new Error("Institution not found");

  const field = edit.fieldName;
  const value = edit.suggestedValue;
  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (field === "coordinates") {
    let coords: [number, number] | null = null;
    if (
      edit.suggestedGeometry &&
      Array.isArray(edit.suggestedGeometry) &&
      edit.suggestedGeometry.length === 2
    ) {
      coords = [parseFloat(edit.suggestedGeometry[0]), parseFloat(edit.suggestedGeometry[1])];
    } else if (value) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length === 2) {
          coords = [parseFloat(parsed[0]), parseFloat(parsed[1])];
        }
      } catch {
        const parts = value.split(",").map((s) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          coords = [parts[0], parts[1]];
        }
      }
    }

    if (coords) {
      updateData.latitude = coords[0];
      updateData.longitude = coords[1];
      updateData.coordinatePrecision = "exact";
      updateData.geom = sql`ST_SetSRID(ST_MakePoint(${coords[1]}, ${coords[0]}), 4326)`;
    } else {
      throw new Error("Invalid coordinates format");
    }
  } else {
    const fieldMap: Record<string, string> = {
      name: "name",
      address: "address",
      status: "status",
      accreditation: "accreditation",
      province: "province",
      city: "city",
      land_ownership: "landOwnership",
      land_total_area_m2: "landTotalAreaM2",
      land_source: "landSource",
      land_certificate_status: "landCertificateStatus",
      land_certificate_number: "landCertificateNumber",
      land_use_categories: "landUseCategories",
      land_use_education: "landUseEducation",
      land_use_dormitory: "landUseDormitory",
      land_use_economic: "landUseEconomic",
      land_use_agriculture: "landUseAgriculture",
      land_use_worship: "landUseWorship",
      land_use_other: "landUseOther",
      land_njop: "landNjop",
      land_price_per_m2: "landPricePerM2",
      land_estimated_total_value: "landEstimatedTotalValue",
      land_valuation_year: "landValuationYear",
      land_parcels: "landParcels",
      notes: "notes",
    };

    if (fieldMap[field]) {
      const colName = fieldMap[field];
      if (["landOwnership", "landParcels", "landUseCategories"].includes(colName)) {
        try {
          updateData[colName] = JSON.parse(value || "[]");
        } catch {
          updateData[colName] = [value];
        }
      } else if (colName === "landTotalAreaM2") {
        updateData[colName] = value ? parseFloat(value) : null;
      } else {
        updateData[colName] = value;
      }
    }

    if (edit.suggestedGeometry && field === "land_geometry") {
      updateData.landGeometry = edit.suggestedGeometry;
    }
  }

  await db
    .update(institutions)
    .set(updateData)
    .where(eq(institutions.id, edit.institutionId));

  return edit.institutionId;
}
