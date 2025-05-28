import { z } from "zod";

import {
  type AnyIConnectionAdapter,
  type AnyIConsumerSchemaTransformationAdapter,
  type AnyIPublicSchemaTransformationAdapter,
} from "@rejot-dev/contract/adapter";
import { Cursors, cursorToString } from "@rejot-dev/contract/cursor";
import { getLogger } from "@rejot-dev/contract/logger";
import type { PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import { getNullCursorsForConsumingPublicSchemas } from "@rejot-dev/contract/manifest-helpers";
import type { IPublishMessageBus, ISubscribeMessageBus } from "@rejot-dev/contract/message-bus";
import type {
  Transaction,
  TransformedOperation,
  TransformedOperationBase,
} from "@rejot-dev/contract/sync";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";

import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";

import { type BackfillSource, ResultSetStore } from "../result-set-store.ts";
import type { ISyncHTTPController } from "../sync-http-service/sync-http-service.ts";
import { PublicSchemaTransformer } from "./public-schema-transformer.ts";
import { SinkWriter } from "./sink-writer.ts";
import { SourceReader } from "./source-reader.ts";

const log = getLogger(import.meta.url);
const tracer = trace.getTracer("rejot_sync-controller");

const meter = metrics.getMeter("rejot_sync-controller");
const transactionsProcessedCounter = meter.createCounter("rejot_sync_transactions_processed", {
  description: "Number of source transactions processed",
});
const transformationsSuccessCounter = meter.createCounter("rejot_sync_transformations_success", {
  description: "Number of successful public schema transformations",
});
const transformationsFailureCounter = meter.createCounter("rejot_sync_transformations_failure", {
  description: "Number of failed public schema transformations",
});
const messagesPublishedCounter = meter.createCounter("rejot_sync_messages_published", {
  description: "Number of messages published to the message bus",
});
const messagesWrittenCounter = meter.createCounter("rejot_sync_messages_written", {
  description: "Number of messages written to sinks",
});

export interface ISyncController {
  getCursors(): Promise<Cursors>;
  start(): Promise<void>;
  prepare(): Promise<void>;
  stop(): Promise<void>;
  close(): Promise<void>;
  startServingHTTPEndpoints(controller: ISyncHTTPController): Promise<void>;
  getPublicSchemas(): Promise<(z.infer<typeof PublicSchemaSchema> & { manifestSlug: string })[]>;
  startBackfill(
    publicSchemaSlug: string,
    publicSchemaMajorVersion: number,
    sql: string,
    values?: unknown[],
  ): Promise<string>;
  state: SyncControllerState;
}

export type SyncControllerState = "initial" | "prepared" | "started" | "stopped" | "closed";

type BackfillWatermark = {
  type: "low" | "high";
  backfillId: string;
};

export function watermarkFromTransaction(transaction: Transaction): BackfillWatermark | null {
  for (const operation of transaction.operations) {
    if (operation.type === "insert" && operation.table === "watermarks") {
      const watermark = operation.new["type"];
      if (watermark === "low" || watermark === "high") {
        return {
          type: watermark,
          backfillId: operation.new["backfill"] as string,
        };
      } else {
        throw new Error(`Unknown watermark type: ${watermark}`);
      }
    }
  }
  return null;
}

function recordToPublicSchemaOperation(
  backfillState: BackfillState,
  record: Record<string, unknown>,
): TransformedOperation {
  return {
    type: "insert",
    object: record,
    sourceManifestSlug: backfillState.sourceManifestSlug,
    sourcePublicSchema: backfillState.sourcePublicSchema,
  };
}

interface BackfillState {
  backfillId: string;
  startTime: Date;
  timeoutMs: number;

  lowMarkerSeen: boolean;
  resultSetStore: ResultSetStore;

  sourcePublicSchema: TransformedOperationBase["sourcePublicSchema"];
  sourceManifestSlug: string;
}

export class SyncController implements ISyncController {
  readonly #publishMessageBus: IPublishMessageBus;
  readonly #subscribeMessageBuses: ISubscribeMessageBus[];
  readonly #syncManifest: SyncManifest;

  readonly #sourceReader: SourceReader;
  readonly #sinkWriter: SinkWriter;
  readonly #publicSchemaTransformer: PublicSchemaTransformer;

  #backfillState: BackfillState | undefined = undefined;

  #httpController?: ISyncHTTPController;
  #state: SyncControllerState = "initial";

  constructor(
    syncManifest: SyncManifest,
    connectionAdapters: AnyIConnectionAdapter[],
    publicSchemaTransformationAdapters: AnyIPublicSchemaTransformationAdapter[],
    consumerSchemaTransformationAdapters: AnyIConsumerSchemaTransformationAdapter[],
    publishMessageBus: IPublishMessageBus,
    subscribeMessageBuses: ISubscribeMessageBus[],
  ) {
    this.#syncManifest = syncManifest;
    this.#sourceReader = new SourceReader(syncManifest, connectionAdapters);
    this.#sinkWriter = new SinkWriter(
      syncManifest,
      connectionAdapters,
      consumerSchemaTransformationAdapters,
    );
    this.#publicSchemaTransformer = new PublicSchemaTransformer(
      syncManifest,
      publicSchemaTransformationAdapters,
    );
    this.#publishMessageBus = publishMessageBus;
    this.#subscribeMessageBuses = subscribeMessageBuses;
  }

  get state(): SyncControllerState {
    return this.#state;
  }

  set state(newState: SyncControllerState) {
    this.#state = newState;
  }

  async getCursors(): Promise<Cursors> {
    return new Cursors([
      ...(await this.#sinkWriter.getCursors()).toArray(),
      ...getNullCursorsForConsumingPublicSchemas(this.#syncManifest.manifests),
    ]);
  }

  async getPublicSchemas() {
    return this.#syncManifest.getPublicSchemas();
  }

  async start() {
    this.state = "started";
    await this.#httpController?.start();

    log.debug("SyncController start race");
    await Promise.race([
      this.#startIterateSourceReader(),
      ...this.#subscribeMessageBuses.map((bus) => this.#startIterateSubscribeMessageBus(bus)),
    ]);
    log.debug("SyncController start race finished, stopping.");
    await this.stop();
    await this.close();
  }

  async #flushResultSet(transactionId: string): Promise<void> {
    if (!this.#backfillState) {
      throw new Error("No backfill state found");
    }

    let flushCount = 0;
    for (const record of this.#backfillState.resultSetStore.getRecordsWithoutDropKeys()) {
      const operation = recordToPublicSchemaOperation(this.#backfillState, record);
      log.trace("Flushing operation", operation);

      await this.#publishMessageBus.publish({
        transactionId: `${transactionId}/${flushCount.toString(16)}`,
        operations: [operation],
      });
      flushCount++;
    }
    log.info(
      `Flushed ${flushCount}/${this.#backfillState.resultSetStore.size()} records to sink, ${this.#backfillState.resultSetStore.size() - flushCount} records were stale`,
    );
    this.#backfillState.resultSetStore.clear();
  }

  async #startIterateSourceReader() {
    if (!this.#sourceReader.hasSources) {
      log.info("No sources found, skipping source reader");
      return;
    }

    for await (const transactionMessage of this.#sourceReader.start()) {
      const { sourceDataStoreSlug, transaction } = transactionMessage;

      const watermark = watermarkFromTransaction(transaction);

      if (watermark) {
        if (!this.#backfillState || this.#backfillState.backfillId !== watermark.backfillId) {
          // The marker we observe here was not generated by this sync controller,
          // this transaction could be from previous sync controller runs that failed during backfill
          log.warn(
            `Found ${watermark.type} marker for unknown backfill ${watermark.backfillId}, ignoring marker`,
          );
          transaction.ack(true);
          continue;
        }

        if (watermark.type === "low") {
          this.#backfillState.lowMarkerSeen = true;
        } else {
          // Is high, so we've completed the backfill
          // Push all records to the sink, that we have not seen in the previous transactions.
          this.#backfillState.lowMarkerSeen = false;

          // The unique identifier for the backfill is the transaction id of the high watermark.
          // The watermark will not be incorporated into the event store, so we can use the transaction id of the high watermark as the unique identifier for the backfill.
          await this.#flushResultSet(transaction.id);
        }
        log.trace(
          `Backfill ${watermark.type} watermark received: ${transaction.id} for backfill ${watermark.backfillId}`,
        );
        transaction.ack(true);
        continue;
      }

      if (this.#backfillState?.lowMarkerSeen) {
        // Any writes happening to records during the backfill will be applied normally but must be
        // dropped from the backfill result set, to prevent backfill records from overwriting newer records in the destination
        for (const operation of transaction.operations) {
          this.#backfillState.resultSetStore.addDropKey(operation);
        }

        // Check here for backfill timeout
        if (this.#backfillState.startTime) {
          const backfillDurationMs = new Date().getTime() - this.#backfillState.startTime.getTime();
          if (backfillDurationMs > this.#backfillState.timeoutMs) {
            log.warn(
              `Backfill ${this.#backfillState.backfillId} timed out after ${this.#backfillState.timeoutMs} ms`,
            );
            this.#backfillState.lowMarkerSeen = false;
            this.#backfillState.resultSetStore.clear();
            this.#backfillState = undefined;
          }
        }
      }

      await tracer.startActiveSpan("process_transaction", async (processSpan) => {
        processSpan.setAttributes({
          source_data_store_slug: sourceDataStoreSlug,
          transaction_id: transaction.id,
        });

        transactionsProcessedCounter.add(1);
        try {
          const operations = await tracer.startActiveSpan(
            "transform_to_public_schema",
            async (transformSpan) => {
              transformSpan.setAttributes({
                source_data_store_slug: sourceDataStoreSlug,
                transaction_id: transaction.id,
              });

              const operations = await this.#publicSchemaTransformer.transformToPublicSchema(
                sourceDataStoreSlug,
                transaction,
              );

              transformationsSuccessCounter.add(1);
              log.trace("Transformed operations", operations);
              transformSpan.end();
              return operations;
            },
          );

          await tracer.startActiveSpan("publish_message", async (publishSpan) => {
            publishSpan.setAttributes({
              transaction_id: transaction.id,
              operation_count: operations.length,
            });

            await this.#publishMessageBus.publish({
              transactionId: transaction.id,
              operations,
            });

            transaction.ack(true);

            await this.#publishMessageBus.publish({
              transactionId: transaction.id,
              operations,
            });

            messagesPublishedCounter.add(1);
            transaction.ack(true);
            publishSpan.end();
          });
        } catch (error) {
          transformationsFailureCounter.add(1);
          log.error("Error transforming transaction", { error });
          transaction.ack(false);
          if (error instanceof Error) {
            processSpan.recordException(error);
          }
          processSpan.setStatus({ code: SpanStatusCode.ERROR });
        } finally {
          processSpan.setStatus({ code: SpanStatusCode.OK });
          processSpan.end();
        }
      });
    }

    log.debug("startIterateSourceReader completed");
  }

  async #startIterateSubscribeMessageBus(messageBus: ISubscribeMessageBus) {
    const cursors = await this.getCursors();

    log.debug("Cursors", cursors.toArray().map(cursorToString));

    messageBus.setInitialCursors(cursors.toArray());

    for await (const message of messageBus.subscribe()) {
      await tracer.startActiveSpan("write_to_sink", async (writeSpan) => {
        writeSpan.setAttributes({
          transaction_id: message.transactionId,
          operation_count: message.operations.length,
        });

        await this.#sinkWriter.write(message);
        messagesWrittenCounter.add(1);
        writeSpan.end();
      });
    }

    log.debug("startIterateMessageBus completed");
  }

  /**
   * Given a public schema
   * 1. Write a low watermark
   * 2. Fetch records from that specific source
   * 3. Add records to the result set store
   * 4. Write a high watermark
   *
   * @param sourceTables
   * @param sql
   * @param values
   * @returns
   */
  async startBackfill(
    publicSchemaSlug: string,
    publicSchemaMajorVersion: number,
    sql: string,
    values?: unknown[],
  ): Promise<string> {
    if (this.#backfillState) {
      throw new Error("Starting new backfill while we haven't completed a previous one!");
    }
    if (this.state !== "started") {
      throw new Error(
        "Sync controller not ready, a replication slot must have been created before starting backfill process.",
      );
    }

    const backfillId = crypto.randomUUID();

    this.#backfillState = {
      backfillId,
      startTime: new Date(),
      timeoutMs: 10000,
      lowMarkerSeen: false,
      resultSetStore: new ResultSetStore(),
      sourcePublicSchema: {
        name: publicSchemaSlug,
        version: {
          major: publicSchemaMajorVersion,
          minor: 0,
        },
      },
      sourceManifestSlug: "default",
    };

    log.info(`Starting backfill ${backfillId} at ${this.#backfillState.startTime}`);

    const datastore = this.#sourceReader.getSourceByPublicSchemaSlug(
      publicSchemaSlug,
      publicSchemaMajorVersion,
    );
    if (!datastore) {
      throw new Error(
        `Data store not found for public schema ${publicSchemaSlug} version ${publicSchemaMajorVersion}`,
      );
    }

    const { source } = datastore;
    await source.writeWatermark("low", backfillId);

    log.trace(`Fetching records for backfill ${backfillId}`);
    const result = await source.getBackfillRecords(sql, values);
    log.trace(`Fetched ${result.length} records for backfill ${backfillId}`);
    this.#backfillState.resultSetStore.addRecords(
      [
        {
          tableRef: "accounts",
          primaryKeyAliases: new Map([["id", "id"]]),
        },
      ],
      result,
    );

    // await new Promise((resolve) => setTimeout(resolve, 10000));
    await source.writeWatermark("high", backfillId);

    return backfillId;
  }

  async startServingHTTPEndpoints(controller: ISyncHTTPController): Promise<void> {
    if (this.#httpController) {
      throw new Error("HTTP controller already started");
    }

    this.#httpController = controller;
  }

  async prepare() {
    await Promise.all(
      Array.from(
        // Create set because we don't want to call prepare on the same items twice.
        new Set([
          this.#sourceReader,
          this.#sinkWriter,
          this.#publishMessageBus,
          ...this.#subscribeMessageBuses,
        ]),
      ).map((item) => item.prepare()),
    );
    this.state = "prepared";
    log.debug("SyncController prepared");
  }

  async stop() {
    await Promise.all(
      Array.from(
        new Set([
          this.#sourceReader,
          this.#publishMessageBus,
          ...this.#subscribeMessageBuses,
          this.#httpController,
        ]),
      ).map((item) => item?.stop()),
    );
    this.state = "stopped";
  }

  async close() {
    await Promise.all(
      Array.from(
        new Set([
          this.#sourceReader,
          this.#sinkWriter,
          this.#publishMessageBus,
          ...this.#subscribeMessageBuses,
        ]),
      ).map((item) => item.close()),
    );
    this.state = "closed";
  }
}
