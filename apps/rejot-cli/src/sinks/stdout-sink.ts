import type { IDataSink, PublicSchemaOperation } from "../source-sink-protocol.ts";

type StdoutOutputSchema = {
  operation: string;
  data?: Record<string, unknown>;
};

export class StdoutSink implements IDataSink {
  constructor() {}

  async prepare(): Promise<void> {}

  async stop(): Promise<void> {}

  async writeData(operation: PublicSchemaOperation): Promise<void> {
    const output: StdoutOutputSchema = {
      operation: operation.type,
      data: operation.type === "insert" || operation.type === "update" ? operation.new : undefined,
    };
    process.stdout.write(JSON.stringify(output) + "\n");
  }
}
