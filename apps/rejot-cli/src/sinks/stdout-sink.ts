import type { IDataSink, Operation } from "../source-sink-protocol.ts";

type StdoutOutputSchema = {
  operation: string;
  source: {
    tableSchema: string;
    tableName: string;
  };
  data: Record<string, unknown>;
};

export class StdoutSink implements IDataSink {
  constructor() {}

  async prepare(): Promise<void> {}

  async stop(): Promise<void> {}

  async writeData(data: Record<string, unknown>, operation: Operation): Promise<void> {
    const output: StdoutOutputSchema = {
      operation: operation.type,
      source: {
        tableSchema: operation.tableSchema,
        tableName: operation.table,
      },
      data,
    };
    process.stdout.write(JSON.stringify(output) + "\n");
  }
}
