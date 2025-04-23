import { z } from "zod";

import type { IConnectionAdapter } from "@rejot-dev/contract/adapter";
import type {
  PostgresConnectionSchema,
  PostgresDataStoreSchema,
} from "@rejot-dev/contract/manifest";
import type { IConnection } from "@rejot-dev/contract/sync";

import { PostgresEventStore } from "../event-store/postgres-event-store.ts";
import { DEFAULT_PUBLICATION_NAME, DEFAULT_SLOT_NAME } from "../postgres-consts.ts";
import { PostgresSink } from "../postgres-sink.ts";
import { PostgresSource } from "../postgres-source.ts";
import { PostgresClient } from "../util/postgres-client.ts";

export interface PostgresConnection extends IConnection<z.infer<typeof PostgresConnectionSchema>> {
  client: PostgresClient;
}

export class PostgresConnectionAdapter
  implements
    IConnectionAdapter<
      z.infer<typeof PostgresConnectionSchema>,
      z.infer<typeof PostgresDataStoreSchema>,
      PostgresSource,
      PostgresSink,
      PostgresEventStore
    >
{
  #connections: Map<string, PostgresConnection> = new Map();

  get connectionType(): "postgres" {
    return "postgres";
  }

  createSource(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
    options: z.infer<typeof PostgresDataStoreSchema>,
  ): PostgresSource {
    return new PostgresSource({
      client: this.getOrCreateConnection(connectionSlug, connection).client,
      publicSchemaSql: "",
      options: {
        createPublication: true,
        publicationName: options.publicationName ?? DEFAULT_PUBLICATION_NAME,
        slotName: options.slotName ?? DEFAULT_SLOT_NAME,
      },
    });
  }

  createSink(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): PostgresSink {
    return new PostgresSink({
      client: this.getOrCreateConnection(connectionSlug, connection).client,
      consumerSchemaSQL: "",
    });
  }

  createEventStore(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): PostgresEventStore {
    return new PostgresEventStore(this.getOrCreateConnection(connectionSlug, connection).client);
  }

  getConnection(connectionSlug: string): PostgresConnection | undefined {
    return this.#connections.get(connectionSlug);
  }

  getOrCreateConnection(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): PostgresConnection {
    let existingConnection = this.#connections.get(connectionSlug);

    if (!existingConnection) {
      const client = PostgresClient.fromConfig(connection);
      existingConnection = {
        slug: connectionSlug,
        config: connection,
        prepare: () => client.connect(),
        close: () => client.end(),
        client,
      };

      this.#connections.set(connectionSlug, existingConnection);
    }

    return existingConnection;
  }

  setConnection(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
    client: PostgresClient,
  ) {
    const existingConnection = this.#connections.get(connectionSlug);

    if (existingConnection) {
      throw new Error(`Connection with slug ${connectionSlug} already exists`);
    }

    this.#connections.set(connectionSlug, {
      slug: connectionSlug,
      config: connection,
      prepare: () => client.connect(),
      close: () => client.end(),
      client,
    });
  }
}
