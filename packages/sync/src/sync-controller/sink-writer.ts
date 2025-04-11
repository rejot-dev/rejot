import { z } from "zod";

import type {
  AnyIConnectionAdapter,
  AnyIConsumerSchemaTransformationAdapter,
  OperationTransformationPair,
} from "@rejot-dev/contract/adapter";
import type { IDataSink } from "@rejot-dev/contract/sync";
import { type Cursor } from "@rejot-dev/contract/cursor";
import type { SyncManifest } from "../../../contract/manifest/sync-manifest";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import type { ConsumerSchemaTransformationSchema } from "@rejot-dev/contract/manifest";
import { logger } from "@rejot-dev/contract/logger";

const log = logger.createLogger("sink-writer");

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

  async getCursors(): Promise<Cursor[]> {
    const cursorsArrays = await Promise.all(
      Array.from(this.#sinks.entries()).map(([slug, sink]) => {
        const adapter = this.#consumerSchemaTransformationAdapters.find(
          (adapter) => adapter.connectionType === sink.connectionType,
        );

        return adapter?.getCursors(slug) ?? [];
      }),
    );
    return cursorsArrays.flat();
  }

  async write({
    operations,
    transactionId,
  }: {
    operations: TransformedOperationWithSource[];
    transactionId: string;
  }) {
    // Group operations by destination and transformation type
    const operationsByDestinationAndType = this.#groupOperationsByDestinationAndType(operations);

    // Execute operations for each destination and type
    const allPromises: Promise<TransformedOperationWithSource[]>[] = [];

    for (const [destinationSlug, operationsByType] of operationsByDestinationAndType.entries()) {
      for (const [transformationType, pairs] of operationsByType.entries()) {
        const adapter = this.#getTransformationAdapter(transformationType);

        allPromises.push(
          adapter.applyConsumerSchemaTransformation(destinationSlug, transactionId, pairs),
        );
      }
    }

    await Promise.all(allPromises);
  }

  #groupOperationsByDestinationAndType(operations: TransformedOperationWithSource[]): Map<
    string, // destinationSlug
    Map<
      z.infer<typeof ConsumerSchemaTransformationSchema>["transformationType"],
      OperationTransformationPair<z.infer<typeof ConsumerSchemaTransformationSchema>>[]
    >
  > {
    // Maps destination slug -> transformation type -> array of operation-transformation pairs
    const result = new Map<
      string,
      Map<
        z.infer<typeof ConsumerSchemaTransformationSchema>["transformationType"],
        OperationTransformationPair<z.infer<typeof ConsumerSchemaTransformationSchema>>[]
      >
    >();

    for (const operation of operations) {
      const consumerSchemas = this.#syncManifest.getConsumerSchemasForPublicSchema(operation);

      // Group transformations by destination and type
      for (const consumerSchema of consumerSchemas) {
        const destinationSlug = consumerSchema.destinationDataStoreSlug;

        if (!result.has(destinationSlug)) {
          result.set(destinationSlug, new Map());
        }

        const transformationsByType = result.get(destinationSlug)!;

        // Group transformations by type
        const transformationsByTransformationType = new Map<
          z.infer<typeof ConsumerSchemaTransformationSchema>["transformationType"],
          z.infer<typeof ConsumerSchemaTransformationSchema>[]
        >();

        for (const transformation of consumerSchema.transformations) {
          const type = transformation.transformationType;

          if (!transformationsByTransformationType.has(type)) {
            transformationsByTransformationType.set(type, []);
          }

          transformationsByTransformationType.get(type)!.push(transformation);
        }

        // Add operation-transformation pairs to the result
        for (const [type, transformations] of transformationsByTransformationType.entries()) {
          if (!transformationsByType.has(type)) {
            transformationsByType.set(type, []);
          }

          transformationsByType.get(type)!.push({
            operation,
            transformations,
          });
        }
      }
    }

    return result;
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
