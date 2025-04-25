import { expect, test } from "bun:test";

import { dbDescribe } from "@/postgres/db-test.ts";

dbDescribe("SystemService tests", async (ctx) => {
  test("create and get system", async () => {
    const systemService = ctx.injector.resolve("systemService");
    const organization = await ctx.resolve("organizationService").createOrganization({
      name: "Test Organization",
    });

    expect(organization).toBeDefined();
    expect(organization.name).toEqual("Test Organization");
    expect(organization.code).toMatch(/^ORG_/);

    const system = await systemService.createSystem(organization.code, {
      name: "Test System",
      slug: "test-system",
    });

    expect(system).toBeDefined();
    expect(system.id).toMatch(/^SYS_/);
    expect(system.name).toEqual("Test System");
    expect(system.organization.id).toEqual(organization.code);
    expect(system.organization.name).toEqual("Test Organization");

    const retrieved = await systemService.getSystem(organization.code, system.slug);
    expect(retrieved).toBeDefined();
    expect(retrieved.id).toEqual(system.id);
    expect(retrieved.name).toEqual(system.name);
    expect(retrieved.slug).toEqual(system.slug);
    expect(retrieved.organization.id).toEqual(organization.code);
    expect(retrieved.organization.name).toEqual("Test Organization");
  });
});
