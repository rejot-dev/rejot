import fs from "node:fs/promises";
import logger from "./logger.ts";

const log = logger.createLogger("transforms");

export async function readSQLFile(path: string): Promise<string> {
  try {
    log.debug(`Reading SQL file from ${path}`);
    const content = await fs.readFile(path, "utf-8");
    log.trace(`SQL file content length: ${content.length} characters`);
    return content;
  } catch (error) {
    log.error(`Failed to read SQL file at ${path}:`, error);
    throw new Error(`Failed to read SQL file at ${path}: ${error}`);
  }
}
