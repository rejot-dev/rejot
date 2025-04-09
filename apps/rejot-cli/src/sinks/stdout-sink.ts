import type { IDataSink, TransformedOperation } from "@rejot-dev/contract/sync";

type StdoutOutputSchema = {
  operation: string;
  data?: Record<string, unknown>;
};

export class StdoutSink implements IDataSink {
  get connectionType(): "stdout" {
    return "stdout";
  }

  async prepare(): Promise<void> {}

  async close(): Promise<void> {}

  async writeData(operation: TransformedOperation): Promise<void> {
    const output: StdoutOutputSchema = {
      operation: operation.type,
      data:
        operation.type === "insert" || operation.type === "update" ? operation.object : undefined,
    };
    process.stdout.write(JSON.stringify(output) + "\n");
  }
}
