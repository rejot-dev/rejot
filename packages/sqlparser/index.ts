import init, {
  parse_sql,
  statements_to_sql,
  find_placeholders_wasm,
  // Note this package lives in a different repo.
} from "@rejot-dev/sqlparser-wasm";
import type { Query } from "./types";

let initialized = false;
export async function initSqlparser(): Promise<void> {
  if (initialized) {
    return;
  }

  await init();
  initialized = true;
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
export * from "./types";
