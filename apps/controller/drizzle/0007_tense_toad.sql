CREATE TYPE "public"."consumer_schema_status" AS ENUM('draft', 'backfill', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."consumer_schema_transformation_type" AS ENUM('postgresql');--> statement-breakpoint
CREATE TABLE "consumer_schema" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consumer_schema_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(30) NOT NULL,
	"data_store_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "consumer_schema_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumer_schema_transformation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consumer_schema_transformation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"consumer_schema_id" integer NOT NULL,
	"type" "consumer_schema_transformation_type" NOT NULL,
	"major_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "consumer_schema_transformation_consumerSchemaId_majorVersion_unique" UNIQUE("consumer_schema_id","major_version")
);
--> statement-breakpoint
CREATE TABLE "consumer_schema_transformation_postgresql" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consumer_schema_transformation_postgresql_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"consumer_schema_transformation_id" integer NOT NULL,
	"sql" text NOT NULL,
	CONSTRAINT "consumer_schema_transformation_postgresql_consumerSchemaTransformationId_unique" UNIQUE("consumer_schema_transformation_id")
);
--> statement-breakpoint
ALTER TABLE "consumer_schema" ADD CONSTRAINT "consumer_schema_data_store_id_data_store_id_fk" FOREIGN KEY ("data_store_id") REFERENCES "public"."data_store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_schema_transformation" ADD CONSTRAINT "consumer_schema_transformation_consumer_schema_id_consumer_schema_id_fk" FOREIGN KEY ("consumer_schema_id") REFERENCES "public"."consumer_schema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer_schema_transformation_postgresql" ADD CONSTRAINT "consumer_schema_transformation_postgresql_consumer_schema_transformation_id_consumer_schema_transformation_id_fk" FOREIGN KEY ("consumer_schema_transformation_id") REFERENCES "public"."consumer_schema_transformation"("id") ON DELETE no action ON UPDATE no action;