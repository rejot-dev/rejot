import { initSchema } from "@example/shared/db";
import { getClient } from "@example/shared/db";

// Initialize database connection and schema
const client = getClient();
await client.connect();
await initSchema(client, "./migrations");
console.log("Database initialized successfully");
