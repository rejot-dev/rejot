import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import init, {
  find_placeholders_wasm,
  parse_sql,
  statements_to_sql,
  // Note this package lives in a different repo.
} from "@rejot-dev/sqlparser-wasm";

import type { Query } from "./types.ts";
let initialized = false;

export async function initSqlparser(): Promise<void> {
  if (initialized) {
    return;
  }

  if (isNode()) {
    await initWasmWorkaround();
  } else {
    await init();
  }

  initialized = true;
}

function isNode(): boolean {
  return !process.versions["bun"] && !process.versions["deno"];
}

// WORKAROUND: Initializing wasm on nodejs doesn't work if packaged with --target=web
// This is only for nodejs, bun and deno work fine.
// See: https://github.com/nodejs/undici/issues/2751
async function initWasmWorkaround() {
  // Save the original fetch implementation
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async function (resource: URL, options) {
      if (resource.protocol === "file:") {
        const filePath = fileURLToPath(resource);
        const buffer = await readFile(filePath);
        return new Response(buffer, {
          headers: {
            "Content-Type": "application/wasm",
          },
        });
      }
      return originalFetch(resource, options);
    } as typeof fetch;

    await init();
  } finally {
    // Restore the original fetch implementation
    globalThis.fetch = originalFetch;
  }
}

// The typing on this is super incomplete.
export type Statement = Query;

export function parseSql(sql: string): Statement[] {
  if (!initialized) {
    throw new Error("Sqlparser not initialized");
  }

  return parse_sql(sql);
}

export function statementsToSql(statements: Statement[]): string {
  if (!initialized) {
    throw new Error("Sqlparser not initialized");
  }

  return statements_to_sql(statements);
}

export interface PlaceholderInfo {
  value: string;
  line: number;
  column: number;
}

export function findPlaceholders(statements: Statement[]): PlaceholderInfo[] {
  if (!initialized) {
    throw new Error("Sqlparser not initialized");
  }

  return find_placeholders_wasm(statements);
}

// Re-export all types
export * from "./types.ts";
