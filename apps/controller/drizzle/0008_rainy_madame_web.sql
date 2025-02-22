CREATE TYPE "public"."dependency_type" AS ENUM('consumer_schema-public_schema');--> statement-breakpoint
CREATE TABLE "dependency" (
	"dependency_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dependency_dependency_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"system_id" bigint NOT NULL,
	"type" "dependency_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dependency_consumer_schema_to_public_schema" (
	"dependency_id" bigint NOT NULL,
	"consumer_schema_id" bigint NOT NULL,
	"public_schema_id" bigint NOT NULL,
	CONSTRAINT "dependency_consumer_schema_to_public_schema_dependencyId_consumerSchemaId_publicSchemaId_unique" UNIQUE("dependency_id","consumer_schema_id","public_schema_id")
);
--> statement-breakpoint
ALTER TABLE "api_key" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "api_key" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "api_key" ALTER COLUMN "organization_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "clerk_user" ALTER COLUMN "person_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "connection" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "connection" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "connection" ALTER COLUMN "organization_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "connection_postgres" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "connection_postgres" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "connection_postgres" ALTER COLUMN "connection_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "connection_postgres" ALTER COLUMN "port" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "consumer_schema" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "consumer_schema" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "consumer_schema" ALTER COLUMN "data_store_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "consumer_schema_transformation" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "consumer_schema_transformation" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "consumer_schema_transformation" ALTER COLUMN "consumer_schema_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "consumer_schema_transformation" ALTER COLUMN "major_version" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "consumer_schema_transformation_postgresql" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "consumer_schema_transformation_postgresql" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "consumer_schema_transformation_postgresql" ALTER COLUMN "consumer_schema_transformation_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "data_store" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "data_store" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "data_store" ALTER COLUMN "connection_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "data_store" ALTER COLUMN "system_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "event_store" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "event_store" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "event_store" ALTER COLUMN "connection_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "person" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "person" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "person_organization" ALTER COLUMN "person_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "person_organization" ALTER COLUMN "organization_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "public_schema" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "public_schema" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "public_schema" ALTER COLUMN "data_store_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "public_schema_transformation" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "public_schema_transformation" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "public_schema_transformation" ALTER COLUMN "public_schema_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "public_schema_transformation" ALTER COLUMN "major_version" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "public_schema_transformation_postgresql" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "public_schema_transformation_postgresql" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "public_schema_transformation_postgresql" ALTER COLUMN "public_schema_transformation_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "schema_snapshot" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "schema_snapshot" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "schema_snapshot" ALTER COLUMN "connection_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "sync_service" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "sync_service" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "sync_service" ALTER COLUMN "system_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "system" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "system" ALTER COLUMN "id" SET MAXVALUE 9223372036854775807;--> statement-breakpoint
ALTER TABLE "system" ALTER COLUMN "organization_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "dependency" ADD CONSTRAINT "dependency_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency_consumer_schema_to_public_schema" ADD CONSTRAINT "dependency_consumer_schema_to_public_schema_dependency_id_dependency_dependency_id_fk" FOREIGN KEY ("dependency_id") REFERENCES "public"."dependency"("dependency_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency_consumer_schema_to_public_schema" ADD CONSTRAINT "dependency_consumer_schema_to_public_schema_consumer_schema_id_consumer_schema_id_fk" FOREIGN KEY ("consumer_schema_id") REFERENCES "public"."consumer_schema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency_consumer_schema_to_public_schema" ADD CONSTRAINT "dependency_consumer_schema_to_public_schema_public_schema_id_public_schema_id_fk" FOREIGN KEY ("public_schema_id") REFERENCES "public"."public_schema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dependency_consumer_schema_to_public_schema_consumer_schema_id_public_schema_id_index" ON "dependency_consumer_schema_to_public_schema" USING btree ("consumer_schema_id","public_schema_id");--> statement-breakpoint
CREATE INDEX "dependency_consumer_schema_to_public_schema_public_schema_id_consumer_schema_id_index" ON "dependency_consumer_schema_to_public_schema" USING btree ("public_schema_id","consumer_schema_id");