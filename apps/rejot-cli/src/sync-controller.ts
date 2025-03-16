import type { IDataSource, IDataSink, TransactionBuffer } from "./source-sink-protocol.ts";
import logger from "./logger.ts";

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
        // Apply transformations
        const transformedData = await this.#source.applyTransformations(operation);

        // Write to sink
        if (transformedData) {
          await this.#sink.writeData(transformedData, operation);
        } else {
          log.warn("No transformed data for operation", operation);
        }
      }

      return true;
    } catch (error) {
      log.error("Error processing transaction buffer:", error);
      return false;
    }
  }
}
