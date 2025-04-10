import {
  type PlaceholderInfo,
  type Statement,
  parseSql,
  findPlaceholders,
  initSqlparser,
} from "@rejot-dev/sqlparser";

interface ParsedSqlResult {
  statements: Statement[];
  placeholders: PlaceholderInfo[];
}

/**
 * A cache for SQL parsing operations to avoid redundant parsing of the same SQL statements.
 * This optimizes performance when the same SQL is processed multiple times.
 */
export class SqlTransformationCache {
  private cache: Map<string, ParsedSqlResult> = new Map();
  private maxCacheSize: number;
  private initialized = false;

  /**
   * Creates a new SQL transformation cache.
   * @param maxCacheSize The maximum number of SQL statements to cache (default: 1000)
   */
  constructor(maxCacheSize = 1000) {
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Initializes the SQL parser.
   */
  public async initialize(): Promise<void> {
    if (!this.initialized) {
      await initSqlparser();
      this.initialized = true;
    }
  }

  /**
   * Parses SQL statements and caches the result.
   * @param sql The SQL statement to parse
   * @returns The parsed statements
   */
  public async parseAndCache(sql: string): Promise<Statement[]> {
    await this.initialize();

    // Check if we have a cached result
    const cachedResult = this.cache.get(sql);
    if (cachedResult) {
      return cachedResult.statements;
    }

    // Parse the SQL and cache the result
    const statements = parseSql(sql);
    const placeholders = findPlaceholders(statements);

    this.cache.set(sql, {
      statements,
      placeholders,
    });

    // Prune the cache if it exceeds the maximum size
    this.pruneCache();

    return statements;
  }

  /**
   * Finds placeholders in SQL statements and caches the result.
   * @param sql The SQL statement to find placeholders in
   * @returns The found placeholders
   */
  public async findPlaceholdersAndCache(sql: string): Promise<PlaceholderInfo[]> {
    await this.initialize();

    // Check if we have a cached result
    let cachedResult = this.cache.get(sql);

    if (!cachedResult) {
      // Parse the SQL and cache the result
      const statements = parseSql(sql);
      const placeholders = findPlaceholders(statements);

      cachedResult = {
        statements,
        placeholders,
      };

      this.cache.set(sql, cachedResult);

      // Prune the cache if it exceeds the maximum size
      this.pruneCache();
    }

    return cachedResult.placeholders;
  }

  /**
   * Parses SQL statements and finds placeholders in a single operation, caching the result.
   * @param sql The SQL statement to parse and find placeholders in
   * @returns An object containing the parsed statements and found placeholders
   */
  public async parseAndFindPlaceholders(sql: string): Promise<{
    statements: Statement[];
    placeholders: PlaceholderInfo[];
  }> {
    await this.initialize();

    // Check if we have a cached result
    let cachedResult = this.cache.get(sql);

    if (!cachedResult) {
      // Parse the SQL and cache the result
      const statements = parseSql(sql);
      const placeholders = findPlaceholders(statements);

      cachedResult = {
        statements,
        placeholders,
      };

      this.cache.set(sql, cachedResult);

      // Prune the cache if it exceeds the maximum size
      this.pruneCache();
    }

    return {
      statements: cachedResult.statements,
      placeholders: cachedResult.placeholders,
    };
  }

  /**
   * Clears the cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets the current size of the cache.
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  private pruneCache(): void {
    if (this.cache.size <= this.maxCacheSize) {
      return;
    }

    // Get all entries as an array
    const entries = [...this.cache.entries()];

    // Remove oldest entries (first items in the cache)
    const entriesToRemove = entries.slice(0, entries.length - this.maxCacheSize);
    for (const [key] of entriesToRemove) {
      this.cache.delete(key);
    }
  }
}

// Create a singleton instance for easier use throughout the application
export const sqlTransformationCache = new SqlTransformationCache();
