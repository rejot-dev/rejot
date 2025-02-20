ALTER TABLE "connection"
ALTER COLUMN "type"
SET NOT NULL;

--> statement-breakpoint
ALTER TABLE "publication"
ADD COLUMN "organization_id" integer NOT NULL;

--> statement-breakpoint
ALTER TABLE "publication"
ADD COLUMN "data_store_id" integer NOT NULL;

--> statement-breakpoint
ALTER TABLE "publication"
ADD COLUMN "slug" varchar(255) NOT NULL;

--> statement-breakpoint
ALTER TABLE "publication"
ADD CONSTRAINT "publication_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization" ("id") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "publication"
ADD CONSTRAINT "publication_data_store_id_data_store_id_fk" FOREIGN KEY ("data_store_id") REFERENCES "public"."data_store" ("id") ON DELETE no action ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "publication"
ADD CONSTRAINT "publication_id_organizationId_dataStoreId_version_slug_unique" UNIQUE (
  "id",
  "organization_id",
  "data_store_id",
  "version",
  "slug"
);
