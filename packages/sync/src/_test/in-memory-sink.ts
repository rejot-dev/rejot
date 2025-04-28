import type { IDataSink, TransformedOperation } from "@rejot-dev/contract/sync";

export class InMemorySink implements IDataSink {
  get connectionType(): "in-memory" {
    return "in-memory";
  }

  async prepare(): Promise<void> {}

  async close(): Promise<void> {}

  async writeData(_operation: TransformedOperation): Promise<void> {
    throw new Error("Not implemented");
  }
}
