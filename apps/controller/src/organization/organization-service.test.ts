import { expect, test } from "bun:test";

import { generateCode } from "../codes/codes.ts";
import { dbDescribe } from "../postgres/db-test.ts";

dbDescribe("OrganizationService tests", async (ctx) => {
  test.only("OrganizationService - Create Organization", async () => {
    console.log("test start");

    const organizationService = ctx.resolve("organizationService");

    const organization = await organizationService.createOrganization({
      name: "Test Organization",
    });

    expect(organization).toBeDefined();
    expect(organization.code).toMatch(/^ORG_/);
    expect(organization.name).toEqual("Test Organization");

    console.log("test end");
  });

  test("OrganizationService - Get Organization", async () => {
    const organizationService = ctx.resolve("organizationService");

    const created = await organizationService.createOrganization({
      name: "Test Organization",
    });

    const organization = await organizationService.getOrganization(created.code);

    expect(organization).toBeDefined();
    expect(organization.id).toEqual(created.id);
    expect(organization.code).toEqual(created.code);
    expect(organization.name).toEqual("Test Organization");
  });

  test("OrganizationService - Get Organization - Not Found", async () => {
    const organizationService = ctx.resolve("organizationService");
    const nonExistentCode = generateCode("ORG");

    await expect(organizationService.getOrganization(nonExistentCode)).rejects.toThrow(
      "Organization not found",
    );
  });
});
