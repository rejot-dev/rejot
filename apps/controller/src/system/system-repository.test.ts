import { dbDescribe } from "@/postgres/db-test.ts";
import { test, expect } from "bun:test";
import { schema } from "@/postgres/schema.ts";

dbDescribe("SystemRepository", async (ctx) => {
  // Helper functions to set up test data
  let orgCounter = 1;
  let sysCounter = 1;

  async function createTestPerson() {
    return await ctx.db
      .insert(schema.person)
      .values({
        code: "PERS_TEST",
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      })
      .returning()
      .then((res) => res[0]);
  }

  async function createTestOrganization() {
    const code = `ORG_TEST_${orgCounter++}`;
    return await ctx.db
      .insert(schema.organization)
      .values({
        code,
        name: "Test Organization",
      })
      .returning()
      .then((res) => res[0]);
  }

  async function createTestSystem(organizationId: number) {
    const code = `SYS_TEST_${sysCounter++}`;
    return await ctx.db
      .insert(schema.system)
      .values({
        code,
        name: "Test System",
        slug: `test-system-${sysCounter}`,
        organizationId,
      })
      .returning()
      .then((res) => res[0]);
  }

  async function createTestClerkUser(personId: number) {
    return await ctx.db
      .insert(schema.clerkUser)
      .values({
        clerkUserId: "test_clerk_user",
        personId,
      })
      .returning()
      .then((res) => res[0]);
  }

  async function createPersonOrganization(personId: number, organizationId: number) {
    return await ctx.db
      .insert(schema.personOrganization)
      .values({
        personId,
        organizationId,
      })
      .returning()
      .then((res) => res[0]);
  }

  test("getSystemsForClerkUser - returns systems for organizations user has access to", async () => {
    const systemRepository = ctx.resolve("systemRepository");

    // Set up test data
    const person = await createTestPerson();
    const org1 = await createTestOrganization();
    const org2 = await createTestOrganization();
    const system1 = await createTestSystem(org1.id);
    await createTestSystem(org2.id); // Create but don't use system2
    const clerkUser = await createTestClerkUser(person.id);
    await createPersonOrganization(person.id, org1.id);

    // Test: should only return system1 as user only has access to org1
    const result = await systemRepository.getSystemsForClerkUser(clerkUser.clerkUserId);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: system1.id,
      code: system1.code,
      name: system1.name,
      slug: system1.slug,
      organization: {
        id: org1.id,
        code: org1.code,
        name: org1.name,
      },
    });
  });

  test("getSystemsForClerkUser - returns multiple systems across organizations", async () => {
    const systemRepository = ctx.resolve("systemRepository");

    // Set up test data
    const person = await createTestPerson();
    const org1 = await createTestOrganization();
    const org2 = await createTestOrganization();
    const system1 = await createTestSystem(org1.id);
    const system2 = await createTestSystem(org2.id);
    const clerkUser = await createTestClerkUser(person.id);
    await createPersonOrganization(person.id, org1.id);
    await createPersonOrganization(person.id, org2.id);

    // Test: should return both systems as user has access to both orgs
    const result = await systemRepository.getSystemsForClerkUser(clerkUser.clerkUserId);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      id: system1.id,
      code: system1.code,
      name: system1.name,
      slug: system1.slug,
      organization: {
        id: org1.id,
        code: org1.code,
        name: org1.name,
      },
    });
    expect(result).toContainEqual({
      id: system2.id,
      code: system2.code,
      name: system2.name,
      slug: system2.slug,
      organization: {
        id: org2.id,
        code: org2.code,
        name: org2.name,
      },
    });
  });

  test("getSystemsForClerkUser - returns empty array for user without organizations", async () => {
    const systemRepository = ctx.resolve("systemRepository");

    // Set up test data
    const person = await createTestPerson();
    const clerkUser = await createTestClerkUser(person.id);

    // Test: should return empty array as user has no org access
    const result = await systemRepository.getSystemsForClerkUser(clerkUser.clerkUserId);

    expect(result).toHaveLength(0);
  });

  test("getSystemsForClerkUser - returns empty array for non-existent clerk user", async () => {
    const systemRepository = ctx.resolve("systemRepository");

    const result = await systemRepository.getSystemsForClerkUser("non_existent_user");

    expect(result).toHaveLength(0);
  });
});
