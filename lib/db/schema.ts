import { pgTable, serial, varchar, json, text, geometry, doublePrecision, timestamp, index, boolean } from "drizzle-orm/pg-core";

export const institutions = pgTable("institutions", {
  id: varchar({ length: 10 }).primaryKey(),
  osmId: varchar("osm_id", { length: 50 }),
  nomorDataLembaga: varchar("nomor_data_lembaga", { length: 20 }),
  name: varchar({ length: 500 }).notNull(),
  type: varchar({ length: 50 }).notNull(),
  level: varchar({ length: 20 }),
  status: varchar({ length: 20 }),
  address: text(),
  province: varchar({ length: 100 }),
  city: varchar({ length: 100 }),
  coordinatePrecision: varchar("coordinate_precision", { length: 30 }),
  geom: geometry(),
  latitude: doublePrecision(),
  longitude: doublePrecision(),
  landTotalAreaM2: doublePrecision("land_total_area_m2"),
  landOwnership: json("land_ownership"),
  landSource: varchar("land_source", { length: 100 }),
  landGeometry: json("land_geometry"),
  landParcels: json("land_parcels"),
  landCertificateStatus: varchar("land_certificate_status", { length: 100 }),
  landCertificateNumber: varchar("land_certificate_number", { length: 100 }),
  landUseCategories: json("land_use_categories"),
  landUseEducation: varchar("land_use_education", { length: 200 }),
  landUseDormitory: varchar("land_use_dormitory", { length: 200 }),
  landUseEconomic: varchar("land_use_economic", { length: 200 }),
  landUseAgriculture: varchar("land_use_agriculture", { length: 200 }),
  landUseWorship: varchar("land_use_worship", { length: 200 }),
  landUseOther: varchar("land_use_other", { length: 200 }),
  landNjop: varchar("land_njop", { length: 100 }),
  landPricePerM2: varchar("land_price_per_m2", { length: 100 }),
  landEstimatedTotalValue: varchar("land_estimated_total_value", { length: 100 }),
  landValuationYear: varchar("land_valuation_year", { length: 10 }),
  accreditation: varchar({ length: 100 }),
  emisCategory: varchar("emis_category", { length: 100 }),
  osmTags: json("osm_tags"),
  source: varchar({ length: 20 }),
  notes: text(),
  verificationStatus: varchar("verification_status", { length: 30 }).default("valid"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  index("idx_institutions_geom").using("gist", table.geom.asc().nullsLast()),
  index("idx_institutions_level").using("btree", table.level.asc().nullsLast()),
  index("idx_institutions_name_trgm").using("btree", table.name.asc().nullsLast()),
  index("idx_institutions_precision").using("btree", table.coordinatePrecision.asc().nullsLast()),
  index("idx_institutions_province").using("btree", table.province.asc().nullsLast()),
  index("idx_institutions_status").using("btree", table.status.asc().nullsLast()),
  index("idx_institutions_type").using("btree", table.type.asc().nullsLast()),
  index("idx_institutions_verification_status").using("btree", table.verificationStatus.asc().nullsLast()),
]);

export const users = pgTable("users", {
  id: serial().primaryKey(),
  username: varchar({ length: 100 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  role: varchar({ length: 50 }).notNull(), // 'super_admin' | 'admin' | 'institusi'
  institutionId: varchar("institution_id", { length: 10 }),
  email: varchar({ length: 255 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_username").using("btree", table.username.asc().nullsLast()),
  index("idx_users_role").using("btree", table.role.asc().nullsLast()),
  index("idx_users_institution_id").using("btree", table.institutionId.asc().nullsLast()),
]);

export const suggestedEdits = pgTable("suggested_edits", {
  id: serial().primaryKey(),
  batchId: varchar("batch_id", { length: 36 }),
  institutionId: varchar("institution_id", { length: 10 }),
  institutionName: varchar("institution_name", { length: 500 }),
  actionType: varchar("action_type", { length: 20 }),
  suggestedPayload: json("suggested_payload"),
  submitterName: varchar("submitter_name", { length: 200 }),
  submitterRole: varchar("submitter_role", { length: 100 }),
  submitterEmail: varchar("submitter_email", { length: 200 }),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  currentValue: text("current_value"),
  suggestedValue: text("suggested_value"),
  suggestedGeometry: json("suggested_geometry"),
  status: varchar({ length: 20 }).default("pending"),
  reviewerNotes: text("reviewer_notes"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const institutionPolygons = pgTable("institution_polygons", {
  id: varchar().primaryKey(),
  institutionId: varchar("institution_id").notNull(),
  name: varchar().notNull(),
  coordinates: json().notNull(),
  areaM2: doublePrecision("area_m2"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_institution_polygons_inst_id").using("btree", table.institutionId.asc().nullsLast()),
]);

export const institutionChildPoints = pgTable("institution_child_points", {
  id: serial().primaryKey(),
  institutionId: varchar("institution_id", { length: 10 }).notNull(),
  polygonId: varchar("polygon_id", { length: 100 }),
  polygonName: varchar("polygon_name", { length: 255 }),
  name: varchar({ length: 255 }).notNull(),
  category: varchar({ length: 100 }).default("gedung"),
  latitude: doublePrecision().notNull(),
  longitude: doublePrecision().notNull(),
  customVariables: json("custom_variables"), // Dynamic key-value pairs or array
  notes: text(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_child_points_inst_id").using("btree", table.institutionId.asc().nullsLast()),
  index("idx_child_points_polygon_id").using("btree", table.polygonId.asc().nullsLast()),
]);

export type Institution = typeof institutions.$inferSelect;
export type NewInstitution = typeof institutions.$inferInsert;
export type SuggestedEdit = typeof suggestedEdits.$inferSelect;
export type NewSuggestedEdit = typeof suggestedEdits.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type InstitutionPolygon = typeof institutionPolygons.$inferSelect;
export type NewInstitutionPolygon = typeof institutionPolygons.$inferInsert;
export type InstitutionChildPoint = typeof institutionChildPoints.$inferSelect;
export type NewInstitutionChildPoint = typeof institutionChildPoints.$inferInsert;
