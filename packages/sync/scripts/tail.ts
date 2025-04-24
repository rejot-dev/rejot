#!/usr/bin/env bun
import { z } from "zod";

import { fetchPublicSchemas, fetchRead } from "../src/sync-http-service/sync-http-service-fetch.ts";
import { CursorSchema } from "../src/sync-http-service/sync-http-service-routes.ts";

async function main() {
  const port = process.argv[2] ? parseInt(process.argv[2], 10) : 3000;
  const host = `localhost:${port}`;

  console.log(`Tailing sync service at http://${host}`);

  // First fetch public schemas
  const publicSchemas = await fetchPublicSchemas(host, false, {
    queryParams: undefined,
    jsonBody: undefined,
  });
  console.log(`Found ${publicSchemas.length} public schemas`);

  // Create cursors from public schemas
  const cursors = publicSchemas.map((schema) => ({
    schema: {
      manifest: {
        slug: schema.manifestSlug,
      },
      schema: {
        name: schema.name,
        version: {
          major: schema.version.major,
        },
      },
    },
    transactionId: null,
  }));

  // Validate cursors
  const validatedCursors = z.array(CursorSchema).parse(cursors);
  console.log(`Created ${validatedCursors.length} cursors`);

  // Build and print request params
  const request = {
    queryParams: {
      cursors: validatedCursors,
      limit: 100,
    },
    jsonBody: undefined,
  };
  console.log("\nRequest params:");
  console.log(JSON.stringify(request, null, 2));

  // Make single read request
  const operations = await fetchRead(host, false, request);
  if (operations.length > 0) {
    console.log(`\nReceived ${operations.length} operations:`);
    for (const operation of operations) {
      console.log(`\nTransaction: ${operation.transactionId}`);
      for (const op of operation.operations) {
        console.log(`  Operation Type: ${op.type}`);
        console.log(`  Source Manifest: ${op.sourceManifestSlug}`);
        console.log(
          `  Public Schema: ${op.sourcePublicSchema.name} v${op.sourcePublicSchema.version.major}.${op.sourcePublicSchema.version.minor}`,
        );
        if (op.type === "insert" || op.type === "update") {
          console.log(`  Object: ${JSON.stringify(op.object, null, 2).split("\n").join("\n    ")}`);
        }
        console.log("");
      }
    }
  } else {
    console.log("\nNo operations received");
  }

  // Print the actual URL that was used
  const protocol = "http";
  const url = new URL(`${protocol}://${host}/read`);
  if (request.queryParams) {
    Object.entries(request.queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, JSON.stringify(value));
      }
    });
  }
  console.log("\nActual URL used:");
  console.log(url.toString());
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
