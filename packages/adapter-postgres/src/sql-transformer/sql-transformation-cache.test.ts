import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { SqlTransformationCache } from "./sql-transformation-cache";

describe("SqlTransformationCache", () => {
  let cache: SqlTransformationCache;

  beforeAll(async () => {
    cache = new SqlTransformationCache();
    await cache.initialize();
  });

  afterEach(() => {
    cache.clearCache();
  });

  it("should parse and cache SQL statements", async () => {
    const sql = "SELECT * FROM users WHERE id = :userId";

    // First call should parse the SQL
    const statements1 = await cache.parseAndCache(sql);
    expect(statements1).toBeDefined();
    expect(cache.getCacheSize()).toBe(1);

    // Second call should use the cache
    const statements2 = await cache.parseAndCache(sql);
    expect(statements2).toBeDefined();
    expect(statements2).toEqual(statements1);
  });

  it("should find and cache placeholders", async () => {
    const sql = "SELECT * FROM users WHERE id = :userId AND name = :userName";

    // First call should parse the SQL and find placeholders
    const placeholders1 = await cache.findPlaceholdersAndCache(sql);
    expect(placeholders1).toBeDefined();
    expect(placeholders1.length).toBe(2);
    expect(placeholders1.map((p) => p.value)).toContain(":userId");
    expect(placeholders1.map((p) => p.value)).toContain(":userName");
    expect(cache.getCacheSize()).toBe(1);

    // Second call should use the cache
    const placeholders2 = await cache.findPlaceholdersAndCache(sql);
    expect(placeholders2).toBeDefined();
    expect(placeholders2).toEqual(placeholders1);
  });

  it("should parse and find placeholders in one operation", async () => {
    const sql = "SELECT * FROM users WHERE id = :userId";

    // First call should parse the SQL and find placeholders
    const result1 = await cache.parseAndFindPlaceholders(sql);
    expect(result1.statements).toBeDefined();
    expect(result1.placeholders).toBeDefined();
    expect(result1.placeholders.length).toBe(1);
    expect(result1.placeholders[0].value).toBe(":userId");
    expect(cache.getCacheSize()).toBe(1);

    // Second call should use the cache
    const result2 = await cache.parseAndFindPlaceholders(sql);
    expect(result2).toBeDefined();
    expect(result2).toEqual(result1);
  });

  it("should prune the cache when it exceeds the maximum size", async () => {
    // Create a cache with a small maximum size
    const smallCache = new SqlTransformationCache(2);
    await smallCache.initialize();

    // Add three items to the cache
    await smallCache.parseAndCache("SELECT * FROM users WHERE id = :userId1");
    expect(smallCache.getCacheSize()).toBe(1);

    await smallCache.parseAndCache("SELECT * FROM users WHERE id = :userId2");
    expect(smallCache.getCacheSize()).toBe(2);

    await smallCache.parseAndCache("SELECT * FROM users WHERE id = :userId3");
    expect(smallCache.getCacheSize()).toBe(2);
  });
});
