import type { IDataSink, TransformedOperation } from "@rejot-dev/contract/sync";

export class InMemorySink implements IDataSink {
  #memory: Map<string, Record<string, unknown>> = new Map();

  get connectionType(): "in-memory" {
    return "in-memory";
  }

  async prepare(): Promise<void> {}

  async close(): Promise<void> {}

  async writeData(operation: TransformedOperation): Promise<void> {
    const { type, keyColumns } = operation;

    if (type === "insert") {
      this.#memory.set(keyColumns.join(":"), operation.object);
    } else if (type === "update") {
      this.#memory.set(keyColumns.join(":"), operation.object);
    } else if (type === "delete") {
      this.#memory.delete(keyColumns.join(":"));
    }
  }
}
