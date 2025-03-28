import { z } from "zod";

import type {
  AnyIConnectionAdapter,
  AnyIConsumerSchemaTransformationAdapter,
} from "@rejot/contract/adapter";
import type { IDataSink } from "@rejot/contract/sync";
import type { SyncManifest } from "../manifest/sync-manifest";
import type { TransformedOperationWithSource } from "@rejot/contract/event-store";
import type { ConsumerSchemaTransformationSchema } from "@rejot/contract/manifest";
import { logger } from "@rejot/contract/logger";

const log = logger.createLogger("sync-writer");

export class SinkWriter {
  readonly #syncManifest: SyncManifest;
  readonly #connectionAdapters: AnyIConnectionAdapter[];
  readonly #consumerSchemaTransformationAdapters: AnyIConsumerSchemaTransformationAdapter[];

  readonly #sinks: Map<string, IDataSink> = new Map();

  constructor(
    syncManifest: SyncManifest,
    connectionAdapters: AnyIConnectionAdapter[],
    consumerSchemaTransformationAdapters: AnyIConsumerSchemaTransformationAdapter[],
  ) {
    this.#syncManifest = syncManifest;
    this.#connectionAdapters = connectionAdapters;
    this.#consumerSchemaTransformationAdapters = consumerSchemaTransformationAdapters;

    this.#createSinks();
  }

  get hasSinks() {
    return this.#sinks.size > 0;
  }

  async write(operations: TransformedOperationWithSource[]) {
    await Promise.all(
      operations.map(async (operation) => {
        const consumerSchemas = this.#syncManifest.getConsumerSchemasForPublicSchema(operation);

        return consumerSchemas.flatMap((consumerSchema) =>
          consumerSchema.transformations.map((transformation) =>
            this.#getTransformationAdapter(
              transformation.transformationType,
            ).applyConsumerSchemaTransformation(
              consumerSchema.destinationDataStoreSlug,
              operation,
              transformation,
            ),
          ),
        );
      }),
    );
  }

  #createSinks() {
    const destinationDataStores = this.#syncManifest.getDestinationDataStores();

    for (const { connectionSlug, connection } of destinationDataStores) {
      const adapter = this.#connectionAdapters.find(
        (adapter) => adapter.connectionType === connection.config.connectionType,
      );

      if (!adapter) {
        throw new Error(
          `No adapter found for connection type: ${connection.config.connectionType}`,
        );
      }

      const sink = adapter.createSink(connectionSlug, connection.config);
      this.#sinks.set(connectionSlug, sink);
    }
  }

  async prepare() {
    await Promise.all([...Array.from(this.#sinks.values()).map((sink) => sink.prepare())]);
  }

  async close() {
    await Promise.all([...Array.from(this.#sinks.values()).map((sink) => sink.close())]);
    log.debug("SinkWriter closed");
  }

  #getTransformationAdapter(
    transformationType: z.infer<typeof ConsumerSchemaTransformationSchema>["transformationType"],
  ) {
    const transformationAdapter = this.#consumerSchemaTransformationAdapters.find(
      (adapter) => adapter.transformationType === transformationType,
    );

    if (!transformationAdapter) {
      throw new Error(
        `No transformation adapter found for transformation type: ${transformationType}`,
      );
    }

    return transformationAdapter;
  }
}
