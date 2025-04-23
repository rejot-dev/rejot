import { z } from "zod";

import type {
  IConsumerSchemaValidationAdapter,
  ValidationResult,
} from "@rejot-dev/contract/adapter";
import type { PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import type { ConsumerSchemaSchema } from "@rejot-dev/contract/manifest";
import type { PostgresConsumerSchemaTransformationSchema } from "@rejot-dev/contract/manifest";

import { validateConsumerSchema } from "../sql-transformer/sql-transformer";

export class PostgresConsumerSchemaValidationAdapter
  implements
    IConsumerSchemaValidationAdapter<z.infer<typeof PostgresConsumerSchemaTransformationSchema>>
{
  get transformationType(): "postgresql" {
    return "postgresql";
  }

  async validateConsumerSchema(
    publicSchema: z.infer<typeof PublicSchemaSchema>,
    consumerSchema: z.infer<typeof ConsumerSchemaSchema>,
  ): Promise<ValidationResult> {
    return validateConsumerSchema(publicSchema, consumerSchema);
  }
}
