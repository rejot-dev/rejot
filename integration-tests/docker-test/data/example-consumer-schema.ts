import { createPostgresConsumerSchemaConfig } from "@rejot-dev/adapter-postgres";
import { createConsumerSchema } from "@rejot-dev/contract/consumer-schema";

const testConsumerSchema = createConsumerSchema("consume-account", {
  source: {
    manifestSlug: "@rejot-test/",
    publicSchema: {
      name: "publish-account",
      majorVersion: 1,
    },
  },
  config: createPostgresConsumerSchemaConfig(
    "sink",
    `INSERT INTO account_destination 
        (id, full_name, email)
      VALUES (
        :id, 
        :firstName || ' ' || :lastName, 
        (:emails::text[])[1] -- select first
      ) ON CONFLICT (id) DO UPDATE
        SET full_name = :firstName || ' ' || :lastName,
            email = (:emails::text[])[1];`,
    {
      deleteSql: `
        DELETE FROM 
          account_destination 
        WHERE id = :id`,
    },
  ),
});

export default {
  testConsumerSchema,
};
