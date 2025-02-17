import { expect, test } from "bun:test";
import { dbDescribe } from "../postgres/db-test.ts";

dbDescribe("SystemService tests", async (ctx) => {
  test("createPublication postgres", async () => {
    const publicationService = ctx.resolve("publicationService");

    const res = await publicationService.createPublication({
      schema: {},
      publicationName: "test",
      metadata: {
        createdAt: Date.now(),
        version: "1.0.0",
      },
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();

    const res2 = await publicationService.getPublicationById(res.data!);
    expect(res2.success).toBe(true);
    expect(res2.data).toBeDefined();

    expect(res2.data!.publicationName).toBe("test");
  });
});

// test("createPublication memory", async () => {
//   const publicationService = createInjector()
//     .provideClass("publicationStore", PublicationMemoryStore)
//     .injectClass(PublicationService);

//   const res = await publicationService.createPublication({
//     schema: {},
//     publicationName: "test",
//     metadata: {
//       createdAt: Date.now(),
//       version: "1.0.0",
//     },
//   });

//   expect(res.success).toBe(true);
//   expect(res.data).toBeDefined();

//   const res2 = await publicationService.getPublicationById(res.data!);
//   expect(res2.success).toBe(true);
//   expect(res2.data).toBeDefined();

//   expect(res2.data!.publicationName).toBe("test");
// });
