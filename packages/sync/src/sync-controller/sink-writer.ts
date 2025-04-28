import { z } from "zod";

import type {
  AnyIConnectionAdapter,
  AnyIConsumerSchemaTransformationAdapter,
} from "@rejot-dev/contract/adapter";
import { Cursors } from "@rejot-dev/contract/cursor";
import { ReJotError } from "@rejot-dev/contract/error";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import { getLogger } from "@rejot-dev/contract/logger";
import type {
  ConsumerSchemaConfigSchema,
  ConsumerSchemaSchema,
} from "@rejot-dev/contract/manifest";
import type { IDataSink, TransformedOperation } from "@rejot-dev/contract/sync";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";

const log = getLogger(import.meta.url);

export class SinkWriterError extends ReJotError {
  get name() {
    return "SinkWriterError";
  }

  constructor(message: string) {
    super(message);
  }
}

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

  async getCursors(): Promise<Cursors> {
    const cursorsArrays = await Promise.all(
      Array.from(this.#sinks.entries()).flatMap(([slug, sink]) => {
        const adapter = this.#consumerSchemaTransformationAdapters.find(
          (adapter) => adapter.connectionType === sink.connectionType,
        );

        return adapter?.getCursors(slug) ?? [];
      }),
    );
    return new Cursors(cursorsArrays.flat());
  }

  async write({
    operations,
    transactionId,
  }: {
    operations: TransformedOperation[];
    transactionId: string;
  }) {
    const operationsByDestinationAndType = this.#groupOperationsByDestinationAndType(operations);

    // Execute operations for each destination and type
    const allPromises: Promise<TransformedOperationWithSource[]>[] = [];

    for (const [destinationSlug, operationsByType] of operationsByDestinationAndType.entries()) {
      const destinationDataStores = this.#syncManifest.getDestinationDataStores();
      const destinationDataStore = destinationDataStores.find(
        (ds) => ds.connectionSlug === destinationSlug,
      );

      if (!destinationDataStore) {
        throw new SinkWriterError(`Destination data store not found: ${destinationSlug}`);
      }

      for (const [consumerSchemaType, operationSchemaPairs] of operationsByType.entries()) {
        const adapter = this.#getConsumerSchemaAdapter(consumerSchemaType);

        allPromises.push(
          adapter.applyConsumerSchemaTransformation(
            destinationSlug,
            transactionId,
            operationSchemaPairs.map((pair) => pair.operation),
            operationSchemaPairs.map((pair) => pair.consumerSchema),
          ),
        );
      }
    }

    await Promise.all(allPromises);
    log.trace("written", { operations: operations.length });
  }

  #groupOperationsByDestinationAndType(operations: TransformedOperation[]): Map<
    string, // destinationSlug
    Map<
      z.infer<typeof ConsumerSchemaConfigSchema>["consumerSchemaType"],
      {
        operation: TransformedOperation;
        consumerSchema: z.infer<typeof ConsumerSchemaSchema>;
      }[]
    >
  > {
    // Maps destination slug -> consumer schema type -> array of operation-schema pairs
    const result = new Map<
      string,
      Map<
        z.infer<typeof ConsumerSchemaConfigSchema>["consumerSchemaType"],
        {
          operation: TransformedOperation;
          consumerSchema: z.infer<typeof ConsumerSchemaSchema>;
        }[]
      >
    >();

    for (const operation of operations) {
      const consumerSchemas = this.#syncManifest.getConsumerSchemasForPublicSchema(operation);

      // Group by destination and consumer schema type
      for (const consumerSchema of consumerSchemas) {
        const destinationSlug = consumerSchema.config.destinationDataStoreSlug;
        const consumerSchemaType = consumerSchema.config.consumerSchemaType;

        // Ensure outer map has the destinationSlug
        if (!result.has(destinationSlug)) {
          result.set(destinationSlug, new Map());
        }
        const operationsByType = result.get(destinationSlug)!;

        // Ensure inner map has the consumerSchemaType
        if (!operationsByType.has(consumerSchemaType)) {
          operationsByType.set(consumerSchemaType, []);
        }
        const operationSchemaPairs = operationsByType.get(consumerSchemaType)!;

        // Add the operation and its corresponding schema
        operationSchemaPairs.push({ operation, consumerSchema });
      }
    }

    return result;
  }

  #getConsumerSchemaAdapter(
    consumerSchemaType: z.infer<typeof ConsumerSchemaConfigSchema>["consumerSchemaType"],
  ) {
    const adapter = this.#consumerSchemaTransformationAdapters.find(
      (adapter) => adapter.transformationType === consumerSchemaType,
    );

    if (!adapter) {
      throw new Error(
        `No consumer schema adapter found for consumer schema type: ${consumerSchemaType}`,
      );
    }

    return adapter;
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
}
