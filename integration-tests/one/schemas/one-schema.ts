import { z } from "zod";

import {
  createPostgresConsumerSchemaConfig,
  createPostgresPublicSchemaTransformations,
  PostgresPublicSchemaConfigBuilder,
} from "@rejot-dev/adapter-postgres";
import { createConsumerSchema } from "@rejot-dev/contract/consumer-schema";
import { createPublicSchema } from "@rejot-dev/contract/public-schema";

const onePersonSchema = createPublicSchema("one-person", {
  source: { dataStoreSlug: "main-connection" },
  outputSchema: z.object({
    id: z.number(),
    firstName: z.string(),
    lastName: z.string(),
    emails: z.array(z.string()),
  }),
  config: new PostgresPublicSchemaConfigBuilder()
    .addTransformation([
      ...createPostgresPublicSchemaTransformations(
        "insertOrUpdate",
        "person",
        `SELECT p.id, p.first_name as "firstName", p.last_name as "lastName", COALESCE(array_agg(e.email) FILTER (WHERE e.email IS NOT NULL), '{}') as emails
         FROM rejot_integration_tests_one.person p
         LEFT JOIN rejot_integration_tests_one.person_email e ON p.id = e.person_id
         WHERE p.id = :id
         GROUP BY p.id, p.first_name, p.last_name`,
      ),
      ...createPostgresPublicSchemaTransformations(
        "insertOrUpdate",
        "person_email",
        `SELECT p.id, p.first_name as "firstName", p.last_name as "lastName", COALESCE(array_agg(e.email) FILTER (WHERE e.email IS NOT NULL), '{}') as emails
         FROM rejot_integration_tests_one.person p
         LEFT JOIN rejot_integration_tests_one.person_email e ON p.id = e.person_id
         WHERE p.id = (SELECT person_id FROM rejot_integration_tests_one.person_email WHERE id = :id)
         GROUP BY p.id, p.first_name, p.last_name`,
      ),
    ])
    .build(),
  version: {
    major: 1,
    minor: 0,
  },
});

const testConsumerSchema = createConsumerSchema("consume-one-person", {
  source: {
    manifestSlug: "@rejot-dev/integration-tests-one",
    publicSchema: {
      name: "one-person",
      majorVersion: 1,
    },
  },
  config: createPostgresConsumerSchemaConfig(
    "main-connection",
    `
      INSERT INTO rejot_integration_tests_one.destination_person_email 
        (id, name, emails)
      VALUES 
        (:id, :firstName || ' ' || :lastName, array_to_string(:emails::text[], ','))
      ON CONFLICT (id) DO UPDATE
        SET name = :firstName || ' ' || :lastName,
            emails = array_to_string(:emails::text[], ',')
      ;
    `,
    {
      deleteSql: "DELETE FROM rejot_integration_tests_one.destination_person_email WHERE id = :id",
    },
  ),
});

export default {
  onePersonSchema,
  testConsumerSchema,
};
