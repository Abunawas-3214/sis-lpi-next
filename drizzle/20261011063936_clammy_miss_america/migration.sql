-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "institutions" (
	"id" varchar(10) PRIMARY KEY,
	"osm_id" varchar(50),
	"nomor_data_lembaga" varchar(20),
	"name" varchar(500) NOT NULL,
	"type" varchar(50) NOT NULL,
	"level" varchar(20),
	"status" varchar(20),
	"address" text,
	"province" varchar(100),
	"city" varchar(100),
	"coordinate_precision" varchar(30),
	"geom" geometry(point,4326),
	"latitude" double precision,
	"longitude" double precision,
	"land_total_area_m2" double precision,
	"land_ownership" json,
	"land_source" varchar(100),
	"land_geometry" json,
	"land_parcels" json,
	"land_certificate_status" varchar(100),
	"land_certificate_number" varchar(100),
	"land_use_categories" json,
	"land_use_education" varchar(200),
	"land_use_dormitory" varchar(200),
	"land_use_economic" varchar(200),
	"land_use_agriculture" varchar(200),
	"land_use_worship" varchar(200),
	"land_use_other" varchar(200),
	"land_njop" varchar(100),
	"land_price_per_m2" varchar(100),
	"land_estimated_total_value" varchar(100),
	"land_valuation_year" varchar(10),
	"accreditation" varchar(100),
	"emis_category" varchar(100),
	"osm_tags" json,
	"source" varchar(20),
	"notes" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "spatial_ref_sys" (
	"srid" integer PRIMARY KEY,
	"auth_name" varchar(256),
	"auth_srid" integer,
	"srtext" varchar(2048),
	"proj4text" varchar(2048),
	CONSTRAINT "spatial_ref_sys_srid_check" CHECK (((srid > 0) AND (srid <= 998999)))
);
--> statement-breakpoint
CREATE TABLE "suggested_edits" (
	"id" serial PRIMARY KEY,
	"batch_id" varchar(36),
	"institution_id" varchar(10),
	"institution_name" varchar(500),
	"action_type" varchar(20),
	"suggested_payload" json,
	"submitter_name" varchar(200),
	"submitter_role" varchar(100),
	"submitter_email" varchar(200),
	"field_name" varchar(100) NOT NULL,
	"current_value" text,
	"suggested_value" text,
	"suggested_geometry" json,
	"status" varchar(20),
	"reviewer_notes" text,
	"reviewed_at" timestamp,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "idx_institutions_geom" ON "institutions" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "idx_institutions_level" ON "institutions" ("level");--> statement-breakpoint
CREATE INDEX "idx_institutions_name_trgm" ON "institutions" ("name");--> statement-breakpoint
CREATE INDEX "idx_institutions_precision" ON "institutions" ("coordinate_precision");--> statement-breakpoint
CREATE INDEX "idx_institutions_province" ON "institutions" ("province");--> statement-breakpoint
CREATE INDEX "idx_institutions_status" ON "institutions" ("status");--> statement-breakpoint
CREATE INDEX "idx_institutions_type" ON "institutions" ("type");--> statement-breakpoint
CREATE VIEW "geography_columns" AS (SELECT current_database() AS f_table_catalog, n.nspname AS f_table_schema, c.relname AS f_table_name, a.attname AS f_geography_column, postgis_typmod_dims(a.atttypmod) AS coord_dimension, postgis_typmod_srid(a.atttypmod) AS srid, postgis_typmod_type(a.atttypmod) AS type FROM pg_class c, pg_attribute a, pg_type t, pg_namespace n WHERE t.typname = 'geography'::name AND a.attisdropped = false AND a.atttypid = t.oid AND a.attrelid = c.oid AND c.relnamespace = n.oid AND (c.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char", 'f'::"char", 'p'::"char"])) AND NOT pg_is_other_temp_schema(c.relnamespace) AND has_table_privilege(c.oid, 'SELECT'::text));--> statement-breakpoint
CREATE VIEW "geometry_columns" AS (SELECT current_database()::character varying(256) AS f_table_catalog, n.nspname AS f_table_schema, c.relname AS f_table_name, a.attname AS f_geometry_column, COALESCE(postgis_typmod_dims(a.atttypmod), sn.ndims, 2) AS coord_dimension, COALESCE(NULLIF(postgis_typmod_srid(a.atttypmod), 0), sr.srid, 0) AS srid, replace(replace(COALESCE(NULLIF(upper(postgis_typmod_type(a.atttypmod)), 'GEOMETRY'::text), st.type, 'GEOMETRY'::text), 'ZM'::text, ''::text), 'Z'::text, ''::text)::character varying(30) AS type FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped JOIN pg_namespace n ON c.relnamespace = n.oid JOIN pg_type t ON a.atttypid = t.oid LEFT JOIN ( SELECT s.connamespace, s.conrelid, s.conkey, (regexp_match(s.consrc, 'geometrytype\(\w+\)\s*=\s*''(\w+)'''::text, 'i'::text))[1] AS type FROM ( SELECT pg_constraint.connamespace, pg_constraint.conrelid, pg_constraint.conkey, pg_get_constraintdef(pg_constraint.oid) AS consrc FROM pg_constraint) s WHERE s.consrc ~* 'geometrytype\(\w+\)\s*=\s*''\w+'''::text) st ON st.connamespace = n.oid AND st.conrelid = c.oid AND (a.attnum = ANY (st.conkey)) LEFT JOIN ( SELECT s.connamespace, s.conrelid, s.conkey, (regexp_match(s.consrc, 'ndims\(\w+\)\s*=\s*(\d+)'::text, 'i'::text))[1]::integer AS ndims FROM ( SELECT pg_constraint.connamespace, pg_constraint.conrelid, pg_constraint.conkey, pg_get_constraintdef(pg_constraint.oid) AS consrc FROM pg_constraint) s WHERE s.consrc ~* 'ndims\(\w+\)\s*=\s*\d+'::text) sn ON sn.connamespace = n.oid AND sn.conrelid = c.oid AND (a.attnum = ANY (sn.conkey)) LEFT JOIN ( SELECT s.connamespace, s.conrelid, s.conkey, (regexp_match(s.consrc, 'srid\(\w+\)\s*=\s*(\d+)'::text, 'i'::text))[1]::integer AS srid FROM ( SELECT pg_constraint.connamespace, pg_constraint.conrelid, pg_constraint.conkey, pg_get_constraintdef(pg_constraint.oid) AS consrc FROM pg_constraint) s WHERE s.consrc ~* 'srid\(\w+\)\s*=\s*\d+'::text) sr ON sr.connamespace = n.oid AND sr.conrelid = c.oid AND (a.attnum = ANY (sr.conkey)) WHERE (c.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char", 'f'::"char", 'p'::"char"])) AND NOT c.relname = 'raster_columns'::name AND t.typname = 'geometry'::name AND NOT pg_is_other_temp_schema(c.relnamespace) AND has_table_privilege(c.oid, 'SELECT'::text));
*/