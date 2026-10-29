CREATE TABLE "institution_child_points" (
	"id" serial PRIMARY KEY,
	"institution_id" varchar(10) NOT NULL,
	"polygon_id" varchar(100),
	"polygon_name" varchar(255),
	"name" varchar(255) NOT NULL,
	"category" varchar(100) DEFAULT 'gedung',
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"custom_variables" json,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"username" varchar(100) NOT NULL UNIQUE,
	"password" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"institution_id" varchar(10),
	"email" varchar(255),
	"is_active" varchar(10) DEFAULT 'true',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP VIEW "geography_columns";--> statement-breakpoint
DROP VIEW "geometry_columns";--> statement-breakpoint
DROP TABLE "spatial_ref_sys";--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "verification_status" varchar(30) DEFAULT 'valid';--> statement-breakpoint
ALTER TABLE "institutions" ALTER COLUMN "geom" SET DATA TYPE geometry(point) USING "geom"::geometry(point);--> statement-breakpoint
ALTER TABLE "suggested_edits" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "suggested_edits" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
CREATE INDEX "idx_child_points_inst_id" ON "institution_child_points" ("institution_id");--> statement-breakpoint
CREATE INDEX "idx_institutions_verification_status" ON "institutions" ("verification_status");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" ("username");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" ("role");--> statement-breakpoint
CREATE INDEX "idx_users_institution_id" ON "users" ("institution_id");