import { assertExists } from "@std/assert/exists";
import { assertEquals } from "@std/assert/equals";
import { assertMatch } from "@std/assert/match";
import { dbDescribe } from "@/postgres/db-test.ts";
import { test } from "bun:test";

dbDescribe("SystemService tests", async (ctx) => {
  test("Create Org - Create System - Get System", async () => {
    const systemService = ctx.injector.resolve("systemService");

    const organization = await ctx
      .resolve("organizationService")
      .createOrganization({
        name: "Test Organization",
      });

    assertExists(organization);
    assertEquals(organization.name, "Test Organization");
    assertMatch(organization.code, /^ORG_/);

    const system = await systemService.createSystem(organization.code, {
      name: "Test System",
      slug: "test-system",
    });

    assertExists(system);
    assertMatch(system.code, /^SYS_/);
    assertEquals(system.name, "Test System");
    assertEquals(system.organization.id, organization.id);
    assertMatch(system.organization.code, /^ORG_/);
    assertEquals(system.organization.code, organization.code);
    assertEquals(system.organization.name, "Test Organization");

    const retrievedSystem = await systemService.getSystem(
      organization.code,
      system.slug
    );

    assertEquals(retrievedSystem.code, system.code);
    assertEquals(retrievedSystem.name, system.name);
    assertExists(retrievedSystem.slug, system.slug);
    assertEquals(retrievedSystem.organization.code, organization.code);
    assertEquals(retrievedSystem.organization.name, "Test Organization");
  });
});
