import { expect, test } from "bun:test";

import type { CodePrefix } from "./codes.ts";
import { generateCode } from "./codes.ts";

test("generateCode - generates valid codes with ORG prefix", () => {
  const code = generateCode("ORG");
  expect(code).toMatch(/^ORG_[0-9A-Za-z]+$/);
  expect(code.startsWith("ORG")).toBeTruthy();
});

test("generateCode - generates valid codes with SYS prefix", () => {
  const code = generateCode("SYS");
  expect(code).toMatch(/^SYS_[0-9A-Za-z]+$/);
  expect(code.startsWith("SYS")).toBeTruthy();
});

test("generateCode - generates valid codes with SYNC prefix", () => {
  const code = generateCode("SYNC");
  expect(code).toMatch(/^SYNC_[0-9A-Za-z]+$/);
  expect(code.startsWith("SYNC")).toBeTruthy();
});

test("generateCode - generates unique codes", () => {
  const iterations = 1000;
  const prefixes: CodePrefix[] = ["ORG", "SYS", "SYNC", "PERS", "CONN", "PUBS", "CONS"];

  for (const prefix of prefixes) {
    const codes = new Set<string>();
    for (let i = 0; i < iterations; i++) {
      const code = generateCode(prefix);
      expect(codes.has(code)).toBeFalsy();
      codes.add(code);
      expect(code.length).toBeLessThanOrEqual(30);
    }
  }
});

test("generateCode - no hyphens", () => {
  const iterations = 1000;
  const prefixes: CodePrefix[] = ["ORG", "SYS", "SYNC", "PERS", "CONN", "PUBS", "CONS"];

  for (const prefix of prefixes) {
    for (let i = 0; i < iterations; i++) {
      const code = generateCode(prefix);
      expect(code.includes("-")).toBeFalsy();
      expect(code.length).toBeLessThanOrEqual(30);
    }
  }
});
