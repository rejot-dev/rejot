CREATE TYPE "public"."public_schema_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."public_schema_transformation_type" AS ENUM('postgresql');--> statement-breakpoint
CREATE TABLE "public_schema_transformation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "public_schema_transformation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"public_schema_id" integer NOT NULL,
	"type" "public_schema_transformation_type" NOT NULL,
	"major_version" integer DEFAULT 1 NOT NULL,
	"base_table" varchar(255) NOT NULL,
	"schema" jsonb NOT NULL,
	CONSTRAINT "public_schema_transformation_publicSchemaId_majorVersion_unique" UNIQUE("public_schema_id","major_version")
);
--> statement-breakpoint
CREATE TABLE "public_schema_transformation_postgresql" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "public_schema_transformation_postgresql_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"public_schema_transformation_id" integer NOT NULL,
	"sql" text NOT NULL,
	CONSTRAINT "public_schema_transformation_postgresql_publicSchemaTransformationId_unique" UNIQUE("public_schema_transformation_id")
);
--> statement-breakpoint
ALTER TABLE "public_schema" DROP CONSTRAINT "public_schema_code_majorVersion_minorVersion_unique";--> statement-breakpoint
ALTER TABLE "public_schema" ADD COLUMN "status" "public_schema_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "public_schema_transformation" ADD CONSTRAINT "public_schema_transformation_public_schema_id_public_schema_id_fk" FOREIGN KEY ("public_schema_id") REFERENCES "public"."public_schema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_schema_transformation_postgresql" ADD CONSTRAINT "public_schema_transformation_postgresql_public_schema_transformation_id_public_schema_transformation_id_fk" FOREIGN KEY ("public_schema_transformation_id") REFERENCES "public"."public_schema_transformation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_schema" DROP COLUMN "major_version";--> statement-breakpoint
ALTER TABLE "public_schema" DROP COLUMN "minor_version";--> statement-breakpoint
ALTER TABLE "public_schema" DROP COLUMN "schema";--> statement-breakpoint
ALTER TABLE "public_schema" ADD CONSTRAINT "public_schema_code_unique" UNIQUE("code");