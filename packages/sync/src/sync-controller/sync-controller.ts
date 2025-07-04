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
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";

import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";

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
  state: SyncControllerState;
}

export type SyncControllerState = "initial" | "prepared" | "started" | "stopped" | "closed";

export class SyncController implements ISyncController {
  readonly #publishMessageBus: IPublishMessageBus;
  readonly #subscribeMessageBuses: ISubscribeMessageBus[];
  readonly #syncManifest: SyncManifest;

  readonly #sourceReader: SourceReader;
  readonly #sinkWriter: SinkWriter;
  readonly #publicSchemaTransformer: PublicSchemaTransformer;

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

  async #startIterateSourceReader() {
    if (!this.#sourceReader.hasSources) {
      log.info("No sources found, skipping source reader");
      return;
    }

    for await (const transactionMessage of this.#sourceReader.start()) {
      const { sourceDataStoreSlug, transaction } = transactionMessage;

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
