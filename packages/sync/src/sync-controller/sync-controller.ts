import type { IMessageBus } from "@rejot/contract/message-bus";
import type { SyncManifest } from "../../../contract/manifest/sync-manifest";
import {
  type AnyIConnectionAdapter,
  type AnyIPublicSchemaTransformationAdapter,
  type AnyIConsumerSchemaTransformationAdapter,
} from "@rejot/contract/adapter";
import { SourceReader } from "./source-reader";
import logger from "@rejot/contract/logger";
import { PublicSchemaTransformer } from "./public-schema-transformer";
import { SinkWriter } from "./sink-writer";
import { cursorToString } from "@rejot/contract/sync";

const log = logger.createLogger("sync-controller");

export class SyncController {
  readonly #publishMessageBus: IMessageBus;
  readonly #subscribeMessageBus: IMessageBus;

  readonly #sourceReader: SourceReader;
  readonly #sinkWriter: SinkWriter;
  readonly #publicSchemaTransformer: PublicSchemaTransformer;

  constructor(
    syncManifest: SyncManifest,
    connectionAdapters: AnyIConnectionAdapter[],
    publicSchemaTransformationAdapters: AnyIPublicSchemaTransformationAdapter[],
    consumerSchemaTransformationAdapters: AnyIConsumerSchemaTransformationAdapter[],
    publishMessageBus: IMessageBus,
    subscribeMessageBus: IMessageBus,
  ) {
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
    this.#subscribeMessageBus = subscribeMessageBus;
  }

  async start() {
    await Promise.all([this.startIterateSourceReader(), this.startIterateMessageBus()]);
  }

  async startIterateSourceReader() {
    if (!this.#sourceReader.hasSources) {
      log.info("No sources found, skipping source reader");
      return;
    }

    for await (const transactionMessage of this.#sourceReader.start()) {
      const { sourceDataStoreSlug, transaction } = transactionMessage;

      try {
        const operations = await this.#publicSchemaTransformer.transformToPublicSchema(
          sourceDataStoreSlug,
          transaction,
        );

        await this.#publishMessageBus.publish({
          transactionId: transaction.id,
          operations,
        });
        transaction.ack(true);
      } catch (error) {
        log.error("Error transforming transaction", { error });
        transaction.ack(false);
      }
    }

    log.debug("startIterateSourceReader completed");
  }

  async startIterateMessageBus() {
    const cursors = await this.#sinkWriter.getCursors();

    log.debug("Cursors", cursors.map(cursorToString));

    this.#subscribeMessageBus.setInitialCursors(cursors);

    for await (const message of this.#subscribeMessageBus.subscribe()) {
      await this.#sinkWriter.write(message);
    }

    log.debug("startIterateMessageBus completed");
  }

  async prepare() {
    await Promise.all([
      this.#sourceReader.prepare(),
      this.#sinkWriter.prepare(),
      this.#publishMessageBus.prepare(),
      this.#subscribeMessageBus.prepare(),
    ]);

    log.debug("SyncController prepared");
  }

  async stop() {
    await Promise.all([
      this.stopIteratorSourceReader(),
      this.stopIteratorMessageBus(),
      this.#publishMessageBus.stop(),
      this.#subscribeMessageBus.stop(),
    ]);
  }

  async stopIteratorSourceReader() {
    return this.#sourceReader.stop();
  }

  async stopIteratorMessageBus() {
    return this.#subscribeMessageBus.stop();
  }

  async close() {
    await Promise.all([
      this.#sourceReader.close(),
      this.#sinkWriter.close(),
      this.#publishMessageBus.close(),
      this.#subscribeMessageBus.close(),
    ]);
  }
}
