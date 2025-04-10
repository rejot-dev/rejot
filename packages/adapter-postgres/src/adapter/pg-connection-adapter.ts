import { z } from "zod";

import type { IConnectionAdapter, CreateSourceOptions } from "@rejot-dev/contract/adapter";
import type { PostgresConnectionSchema } from "../postgres-schemas.ts";
import { PostgresSource } from "../postgres-source.ts";
import { DEFAULT_PUBLICATION_NAME, DEFAULT_SLOT_NAME } from "../postgres-consts.ts";
import { PostgresEventStore } from "../event-store/postgres-event-store.ts";
import { PostgresClient } from "../util/postgres-client.ts";
import { PostgresSink } from "../postgres-sink.ts";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";

export interface PostgresConnection {
  slug: string;
  config: z.infer<typeof PostgresConnectionSchema>;
  client: PostgresClient;
}

export class PostgresConnectionAdapter
  implements
    IConnectionAdapter<
      z.infer<typeof PostgresConnectionSchema>,
      PostgresSource,
      PostgresSink,
      PostgresEventStore
    >
{
  #manifest: SyncManifest;

  #connections: Map<string, PostgresConnection> = new Map();

  constructor(manifest: SyncManifest) {
    this.#manifest = manifest;
  }

  get connectionType(): "postgres" {
    return "postgres";
  }

  createSource(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
    options?: CreateSourceOptions,
  ): PostgresSource {
    return new PostgresSource({
      client: this.#getOrCreateConnection(connectionSlug, connection).client,
      publicSchemaSql: "",
      options: {
        createPublication: true,
        publicationName: options?.publicationName ?? DEFAULT_PUBLICATION_NAME,
        slotName: options?.slotName ?? DEFAULT_SLOT_NAME,
      },
    });
  }

  createSink(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): PostgresSink {
    return new PostgresSink({
      client: this.#getOrCreateConnection(connectionSlug, connection).client,
      consumerSchemaSQL: "",
    });
  }

  createEventStore(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): PostgresEventStore {
    return new PostgresEventStore(
      this.#getOrCreateConnection(connectionSlug, connection).client,
      this.#manifest,
    );
  }

  getConnection(connectionSlug: string): PostgresConnection | undefined {
    return this.#connections.get(connectionSlug);
  }

  #getOrCreateConnection(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): PostgresConnection {
    let existingConnection = this.#connections.get(connectionSlug);

    if (!existingConnection) {
      existingConnection = {
        slug: connectionSlug,
        config: connection,
        client: PostgresClient.fromConfig(connection),
      };

      this.#connections.set(connectionSlug, existingConnection);
    }

    return existingConnection;
  }
}
