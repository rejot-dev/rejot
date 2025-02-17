import { assertExists } from "@std/assert/exists";
import { generateCode } from "../codes/codes.ts";
import { assertEquals } from "@std/assert/equals";
import { assertMatch } from "@std/assert/match";
import { dbDescribe } from "../postgres/db-test.ts";
import { assertRejects } from "@std/assert/rejects";
import { test } from "bun:test";

dbDescribe("OrganizationService tests", async (ctx) => {
  test("OrganizationService - Create Organization", async () => {
    const organizationService = ctx.resolve("organizationService");

    const organization = await organizationService.createOrganization({
      name: "Test Organization",
    });

    assertExists(organization);
    assertMatch(organization.code, /^ORG_/);
    assertEquals(organization.name, "Test Organization");
  });

  test("OrganizationService - Get Organization", async () => {
    const organizationService = ctx.resolve("organizationService");

    const created = await organizationService.createOrganization({
      name: "Test Organization",
    });

    const organization = await organizationService.getOrganization(created.code);

    assertExists(organization);
    assertEquals(organization.id, created.id);
    assertEquals(organization.code, created.code);
    assertEquals(organization.name, "Test Organization");
  });

  test("OrganizationService - Get Organization - Not Found", async () => {
    const organizationService = ctx.resolve("organizationService");
    const nonExistentCode = generateCode("ORG");

    await assertRejects(
      () => organizationService.getOrganization(nonExistentCode),
      Error,
      "Organization not found",
    );
  });
});
