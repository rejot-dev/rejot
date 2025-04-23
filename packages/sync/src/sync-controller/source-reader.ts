import type { AnyIConnectionAdapter } from "@rejot-dev/contract/adapter";
import { getLogger } from "@rejot-dev/contract/logger";
import type { IDataSource, Transaction } from "@rejot-dev/contract/sync";

import type { SyncManifest } from "../../../contract/manifest/sync-manifest";

const log = getLogger(import.meta.url);

export type SourceReaderState = "initial" | "prepared" | "running" | "stopped" | "closed";

type SourceDataStore = {
  manifestSlug: string;
  connectionSlug: string;
  source: IDataSource;
};

export type SourceTransaction = {
  sourceManifestSlug: string;
  sourceDataStoreSlug: string;
  transaction: Transaction;
};

export class SourceReader {
  readonly #syncManifest: SyncManifest;
  readonly #connectionAdapters: AnyIConnectionAdapter[];

  readonly #sources: Map<string, SourceDataStore> = new Map();

  readonly #abortController: AbortController;

  #state: SourceReaderState = "initial";

  constructor(syncManifest: SyncManifest, connectionAdapters: AnyIConnectionAdapter[]) {
    this.#syncManifest = syncManifest;
    this.#connectionAdapters = connectionAdapters;

    this.#abortController = new AbortController();

    this.#createSources();
  }

  get hasSources() {
    return this.#sources.size > 0;
  }

  #createSources() {
    const sourceDataStores = this.#syncManifest.getSourceDataStores();

    for (const { sourceManifestSlug, connectionSlug, config, connection } of sourceDataStores) {
      const adapter = this.#connectionAdapters.find(
        (adapter) => adapter.connectionType === connection.config.connectionType,
      );

      if (!adapter) {
        throw new Error(
          `No adapter found for connection type: ${connection.config.connectionType}`,
        );
      }

      const source = adapter.createSource(connectionSlug, connection.config, config);

      this.#sources.set(connectionSlug, {
        manifestSlug: sourceManifestSlug,
        connectionSlug,
        source,
      });
    }
  }

  async prepare() {
    await Promise.all([
      ...Array.from(this.#sources.values()).map(({ source }) => source.prepare()),
    ]);

    this.#state = "prepared";
  }

  async *start(): AsyncIterable<SourceTransaction> {
    switch (this.#state) {
      case "initial":
        throw new Error("SourceReader is not prepared, call prepare() first.");
      case "prepared":
        this.#state = "running";
        break;
      case "running":
        throw new Error("SourceReader is already running");
      case "stopped":
        throw new Error("SourceReader is stopped");
      case "closed":
        throw new Error("SourceReader is closed");
    }

    const sourceIterators = Array.from(this.#sources.values()).map((sourceStore) => ({
      ...sourceStore,
      iterator: sourceStore.source.startIteration(this.#abortController.signal),
    }));

    while (this.#state === "running") {
      try {
        // Wait for any source to produce a transaction
        const results = await Promise.race(
          sourceIterators.map(async (sourceStore) => {
            const result = await sourceStore.iterator.next();
            if (result.done) {
              return { ...sourceStore, result: null };
            }
            return { ...sourceStore, result: result.value };
          }),
        );
        const { connectionSlug, manifestSlug, result: transaction } = results;
        if (!transaction) {
          log.warn(`Source '${connectionSlug}' stopped iterating.`);
          await this.stop();
          break;
        }

        yield {
          sourceManifestSlug: manifestSlug,
          sourceDataStoreSlug: connectionSlug,
          transaction,
        };
      } catch (error) {
        log.error("Error processing transaction:", error);
        throw error;
      }
    }

    log.debug("SourceReader iteration completed.");
  }

  async stop() {
    this.#abortController.abort();
    this.#state = "stopped";
    log.debug("SourceReader stopped");
  }

  async close() {
    log.debug("Closing SourceReader", { sourcesN: this.#sources.size });
    await Promise.all([...Array.from(this.#sources.values()).map(({ source }) => source.close())]);

    this.#state = "closed";
    log.debug("SourceReader closed");
  }
}
