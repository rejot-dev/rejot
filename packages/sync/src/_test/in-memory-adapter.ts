import type { CreateSourceOptions, IConnectionAdapter } from "@rejot/contract/adapter";
import { InMemorySource } from "./in-memory-source";
import { InMemoryConnectionConfigSchema } from "@rejot/contract/manifest";
import { z } from "zod";
import { InMemoryEventStore } from "./in-memory-event-store";
import { InMemorySink } from "./in-memory-sink";

export class InMemoryConnectionAdapter
  implements
    IConnectionAdapter<
      z.infer<typeof InMemoryConnectionConfigSchema>,
      InMemorySource,
      InMemorySink,
      InMemoryEventStore
    >
{
  #sources: Map<string, InMemorySource> = new Map();
  #sinks: Map<string, InMemorySink> = new Map();

  get connectionType(): "in-memory" {
    return "in-memory";
  }

  createSource(
    _connectionSlug: string,
    _connection: z.infer<typeof InMemoryConnectionConfigSchema>,
    _options?: CreateSourceOptions,
  ): InMemorySource {
    let source = this.#sources.get(_connectionSlug);
    if (!source) {
      source = new InMemorySource();
      this.#sources.set(_connectionSlug, source);
    }
    return source;
  }

  createEventStore(
    _connectionSlug: string,
    _connection: z.infer<typeof InMemoryConnectionConfigSchema>,
  ): InMemoryEventStore {
    return new InMemoryEventStore();
  }

  createSink(
    _connectionSlug: string,
    _connection: z.infer<typeof InMemoryConnectionConfigSchema>,
  ): InMemorySink {
    let sink = this.#sinks.get(_connectionSlug);
    if (!sink) {
      sink = new InMemorySink();
      this.#sinks.set(_connectionSlug, sink);
    }
    return sink;
  }
}
