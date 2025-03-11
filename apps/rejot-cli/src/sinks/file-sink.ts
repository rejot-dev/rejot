import fs from "node:fs/promises";
import logger from "../logger.ts";
import type { IDataSink, Operation } from "../source-sink-protocol.ts";

const log = logger.createLogger("file-sink");

type FileOutputSchema = {
  operation: string;
  source: {
    tableSchema: string;
    tableName: string;
  };
  data: Record<string, unknown>;
};

type FileSinkConfig = {
  filePath: string;
};

export class FileSink implements IDataSink {
  #filePath: string;
  #fileHandle: fs.FileHandle | null = null;

  constructor({ filePath }: FileSinkConfig) {
    this.#filePath = filePath;
  }

  async prepare(): Promise<void> {
    try {
      // Open file for append only writing
      this.#fileHandle = await fs.open(this.#filePath, "a");
      log.trace(`File sink ready: ${this.#filePath}`);
    } catch (error) {
      log.error(`Error opening file ${this.#filePath}:`, error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.#fileHandle) {
      try {
        await this.#fileHandle.close();
        this.#fileHandle = null;
        log.trace(`Closed file: ${this.#filePath}`);
      } catch (error) {
        log.error(`Error closing file ${this.#filePath}:`, error);
      }
    }
  }

  async writeData(data: Record<string, unknown>, operation: Operation): Promise<void> {
    if (!this.#fileHandle) {
      throw new Error(`File ${this.#filePath} not open for writing`);
    }

    const jsonData: FileOutputSchema = {
      operation: operation.type,
      source: {
        tableSchema: operation.tableSchema,
        tableName: operation.table,
      },
      data,
    };
    const output = JSON.stringify(jsonData) + "\n";
    await this.#fileHandle.write(output);
    log.trace(`Successfully wrote data to file: ${this.#filePath}`);
  }
}
