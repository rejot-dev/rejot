ALTER TABLE "publication" RENAME TO "public_schema";--> statement-breakpoint
ALTER TABLE "public_schema" DROP CONSTRAINT "publication_id_organizationId_dataStoreId_version_slug_unique";--> statement-breakpoint
ALTER TABLE "public_schema" DROP CONSTRAINT "publication_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "public_schema" DROP CONSTRAINT "publication_data_store_id_data_store_id_fk";
--> statement-breakpoint
ALTER TABLE "public_schema" ADD COLUMN "code" varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "public_schema" ADD COLUMN "major_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "public_schema" ADD COLUMN "minor_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "public_schema" ADD CONSTRAINT "public_schema_data_store_id_data_store_id_fk" FOREIGN KEY ("data_store_id") REFERENCES "public"."data_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_schema" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "public_schema" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "public_schema" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "public_schema" ADD CONSTRAINT "public_schema_code_majorVersion_minorVersion_unique" UNIQUE("code","major_version","minor_version");