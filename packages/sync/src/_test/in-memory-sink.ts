import type { IDataSink, PublicSchemaOperation } from "@rejot/contract/sync";

export class InMemorySink implements IDataSink {
  #memory: Map<string, Record<string, unknown>> = new Map();

  async prepare(): Promise<void> {}

  async stop(): Promise<void> {}

  async writeData(operation: PublicSchemaOperation): Promise<void> {
    const { type, keyColumns } = operation;

    if (type === "insert") {
      this.#memory.set(keyColumns.join(":"), operation.new);
    } else if (type === "update") {
      this.#memory.set(keyColumns.join(":"), operation.new);
    } else if (type === "delete") {
      this.#memory.delete(keyColumns.join(":"));
    }
  }
}
