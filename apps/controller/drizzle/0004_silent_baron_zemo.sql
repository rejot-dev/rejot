ALTER TABLE "connection_postgres" ADD COLUMN "ssl" boolean DEFAULT false NOT NULL;
ALTER TABLE "connection_postgres" ALTER COLUMN "ssl" SET DEFAULT true;
