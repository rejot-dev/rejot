import type { IDataSource, IDataSink, TransactionBuffer } from "./source-sink-protocol.ts";
import logger from "./logger.ts";
import { PostgresSource } from "./sources/postgres-source.ts";

const log = logger.createLogger("sync-controller");

type SyncControllerConfig = {
  source: IDataSource;
  sink: IDataSink;
};

export class SyncController {
  #source: IDataSource;
  #sink: IDataSink;

  constructor({ source, sink }: SyncControllerConfig) {
    this.#source = source;
    this.#sink = sink;
  }

  async start(): Promise<void> {
    log.info("Initializing sync process...");

    // Connect to source and sink
    await this.#source.prepare();
    await this.#sink.prepare();

    // Start listening for changes
    await this.#source.subscribe(async (buffer) => this.#processTransactionBuffer(buffer));
  }

  async stop(): Promise<void> {
    try {
      await this.#source.stop();
    } catch (error) {
      log.error("Error stopping source:", error);
    }
    try {
      await this.#sink.stop();
    } catch (error) {
      log.error("Error stopping sink:", error);
    }
  }

  async #processTransactionBuffer(buffer: TransactionBuffer): Promise<boolean> {
    log.info(`Processing transaction ${buffer.xid} with ${buffer.operations.length} operations`);

    try {
      // Process each operation in the transaction
      for (const operation of buffer.operations) {
        if (operation.type === "delete") {
          // Skip delete operations for now
          continue;
        }

        // Apply public schema transformation
        let transformedData: Record<string, unknown> | null = null;

        if (this.#source instanceof PostgresSource) {
          transformedData = await this.#source.applyPublicSchemaTransformation(operation);
        } else {
          log.warn("Unsupported source type for transformation");
          continue;
        }

        if (!transformedData) continue;

        // Write to sink
        await this.#sink.writeData(transformedData, operation);
      }

      return true;
    } catch (error) {
      log.error("Error processing transaction buffer:", error);
      return false;
    }
  }
}
