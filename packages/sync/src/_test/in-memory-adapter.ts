import type { CreateSourceOptions, IConnectionAdapter } from "@rejot/contract/adapter";
import { InMemorySource } from "./in-memory-source";
import { InMemoryConnectionConfigSchema } from "@rejot/contract/manifest";
import { z } from "zod";
import { InMemoryEventStore } from "./in-memory-event-store";

export class InMemoryConnectionAdapter
  implements IConnectionAdapter<z.infer<typeof InMemoryConnectionConfigSchema>, InMemorySource>
{
  #source: InMemorySource | null = null;

  get connectionType(): "in-memory" {
    return "in-memory";
  }

  createSource(
    _connection: z.infer<typeof InMemoryConnectionConfigSchema>,
    _options?: CreateSourceOptions,
  ): InMemorySource {
    if (!this.#source) {
      this.#source = new InMemorySource();
    }
    return this.#source;
  }

  createEventStore(
    _connection: z.infer<typeof InMemoryConnectionConfigSchema>,
  ): InMemoryEventStore {
    return new InMemoryEventStore();
  }
}
