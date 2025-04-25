import { expect, test } from "bun:test";

import { generateCode } from "@/codes/codes.ts";
import { dbDescribe } from "@/postgres/db-test.ts";

dbDescribe("ClerkRepository tests", async (ctx) => {
  test("ClerkRepository - Insert Person And Clerk User", async () => {
    const clerkRepository = ctx.resolve("clerkRepository");

    await clerkRepository.insertPersonAndClerkUser({
      clerkUserId: "123",
      person: {
        code: generateCode("PERS"),
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
      },
    });

    // did not throw :)
  });

  test("ClerkRepository - Check Person is updated on conflict", async () => {
    const clerkRepository = ctx.resolve("clerkRepository");

    const clerkUserId = "USER_SOME_ID";

    const code = generateCode("PERS");

    const didInsert1 = await clerkRepository.insertPersonAndClerkUser({
      clerkUserId,
      person: {
        code,
        firstName: "John",
        lastName: "Doe",
        email: `john.doe@example.com`,
      },
    });

    expect(didInsert1).toBe(true);

    const code2 = generateCode("PERS");
    const didInsert2 = await clerkRepository.insertPersonAndClerkUser({
      clerkUserId,
      person: {
        code: code2,
        firstName: "Jane",
        lastName: "Doe",
        email: `jane.doe@example.com`,
      },
    });

    expect(didInsert2).toBe(false);

    // TODO: We should check the person object here but we currently cannot because our test infra is
    //       bad.
  });
});
