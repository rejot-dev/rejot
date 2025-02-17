CREATE TYPE "public"."connection_type" AS ENUM('postgres');--> statement-breakpoint
CREATE TYPE "public"."sync_service_status" AS ENUM('onboarding', 'active', 'paused');--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "api_key_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" integer NOT NULL,
	"key" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clerk_user" (
	"clerk_user_id" varchar(255) PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connection" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "connection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" integer NOT NULL,
	"slug" varchar(255) NOT NULL,
	"type" "connection_type",
	CONSTRAINT "connection_organizationId_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "connection_postgres" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "connection_postgres_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"connection_id" integer NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer NOT NULL,
	"user" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"database" varchar(255) NOT NULL,
	CONSTRAINT "connection_postgres_connectionId_unique" UNIQUE("connection_id")
);
--> statement-breakpoint
CREATE TABLE "data_store" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "data_store_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"connection_id" integer NOT NULL,
	"system_id" integer NOT NULL,
	"publication_name" varchar(255),
	"publication_tables" varchar(255)[],
	"example" varchar(255),
	CONSTRAINT "data_store_connectionId_unique" UNIQUE("connection_id")
);
--> statement-breakpoint
CREATE TABLE "event_store" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_store_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"connection_id" integer NOT NULL,
	CONSTRAINT "event_store_connectionId_unique" UNIQUE("connection_id")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "organization_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(30) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "person_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(30) NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "person_code_unique" UNIQUE("code"),
	CONSTRAINT "person_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "person_organization" (
	"person_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	CONSTRAINT "person_organization_personId_organizationId_unique" UNIQUE("person_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "publication" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "publication_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"version" varchar(10) NOT NULL,
	"schema" jsonb
);
--> statement-breakpoint
CREATE TABLE "schema_snapshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "schema_snapshot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"connection_id" integer NOT NULL,
	"schema_name" varchar(255) NOT NULL,
	"table_name" varchar(255) NOT NULL,
	"schema" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "schema_snapshot_connectionId_schemaName_tableName_unique" UNIQUE("connection_id","schema_name","table_name")
);
--> statement-breakpoint
CREATE TABLE "sync_service" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_service_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(30) NOT NULL,
	"system_id" integer NOT NULL,
	"slug" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" "sync_service_status",
	CONSTRAINT "sync_service_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "system" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "system_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(30) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"organization_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clerk_user" ADD CONSTRAINT "clerk_user_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection" ADD CONSTRAINT "connection_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_postgres" ADD CONSTRAINT "connection_postgres_connection_id_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_store" ADD CONSTRAINT "data_store_connection_id_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_store" ADD CONSTRAINT "data_store_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_store" ADD CONSTRAINT "event_store_connection_id_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_organization" ADD CONSTRAINT "person_organization_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_organization" ADD CONSTRAINT "person_organization_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_snapshot" ADD CONSTRAINT "schema_snapshot_connection_id_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_service" ADD CONSTRAINT "sync_service_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system" ADD CONSTRAINT "system_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;