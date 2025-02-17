import { assert, assertEquals, assertMatch } from "@std/assert";
import { generateCode } from "./codes.ts";
import type { CodePrefix } from "./codes.ts";
import { test } from "bun:test";

test("generateCode - generates valid codes with ORG prefix", () => {
  const code = generateCode("ORG");

  assertMatch(code, /^ORG_[0-9A-Za-z]+$/);
  assertEquals(code.startsWith("ORG"), true);
});

test("generateCode - generates valid codes with SYS prefix", () => {
  const code = generateCode("SYS");
  assertMatch(code, /^SYS_[0-9A-Za-z]+$/);
  assertEquals(code.startsWith("SYS"), true);
});

test("generateCode - generates valid codes with SYNC prefix", () => {
  const code = generateCode("SYNC");
  assertMatch(code, /^SYNC_[0-9A-Za-z]+$/);
  assertEquals(code.startsWith("SYNC"), true);
});

test("generateCode - generates unique codes", () => {
  const codes = new Set();
  const iterations = 1000;
  const prefixes: CodePrefix[] = ["ORG", "SYS", "SYNC"];

  for (const prefix of prefixes) {
    for (let i = 0; i < iterations; i++) {
      const code = generateCode(prefix);
      assertEquals(codes.has(code), false, "Generated duplicate code");
      codes.add(code);
      assert(code.length <= 30, `Generated code should be <30 characters long, was ${code.length}`);
    }
  }
});

test("generateCode - generates codes without hyphens", () => {
  const iterations = 100;
  const prefixes: CodePrefix[] = ["ORG", "SYS", "SYNC"];

  for (const prefix of prefixes) {
    for (let i = 0; i < iterations; i++) {
      const code = generateCode(prefix);
      assertEquals(code.includes("-"), false, "Generated code should not contain hyphens");
      assert(code.length <= 30, `Generated code should be <30 characters long, was ${code.length}`);
    }
  }
});
