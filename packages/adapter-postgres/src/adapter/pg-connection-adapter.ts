import { z } from "zod";

import type { IConnectionAdapter } from "@rejot-dev/contract/adapter";
import type {
  PostgresConnectionSchema,
  PostgresDataStoreSchema,
} from "@rejot-dev/contract/manifest";
import type { IConnection } from "@rejot-dev/contract/sync";

import { PostgresEventStore } from "../event-store/postgres-event-store.ts";
import { PostgresSink } from "../postgres-sink.ts";
import { PostgresSource } from "../postgres-source.ts";
import type { IPostgresClient } from "../util/postgres-client.ts";
import { PostgresClient } from "../util/postgres-client.ts";

export interface IPostgresConnection extends IConnection<z.infer<typeof PostgresConnectionSchema>> {
  client: IPostgresClient;
}

export interface IPostgresConnectionAdapter
  extends IConnectionAdapter<
    z.infer<typeof PostgresConnectionSchema>,
    z.infer<typeof PostgresDataStoreSchema>,
    PostgresSource,
    PostgresSink,
    PostgresEventStore
  > {
  getConnection(connectionSlug: string): IPostgresConnection | undefined;

  setConnection(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
    client: IPostgresClient,
  ): void;
}

export interface PostgresConnection extends IPostgresConnection {
  client: PostgresClient;
}

export class PostgresConnectionAdapter implements IPostgresConnectionAdapter {
  #connections: Map<string, IPostgresConnection> = new Map();

  get connectionType(): "postgres" {
    return "postgres";
  }

  createSource(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
    { publicationName, slotName }: z.infer<typeof PostgresDataStoreSchema>,
  ): PostgresSource {
    return new PostgresSource({
      client: this.getOrCreateConnection(connectionSlug, connection).client,
      options: {
        createPublication: true,
        publicationName: publicationName,
        slotName: slotName,
      },
    });
  }

  createSink(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): PostgresSink {
    return new PostgresSink({
      client: this.getOrCreateConnection(connectionSlug, connection).client,
    });
  }

  createEventStore(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): PostgresEventStore {
    return new PostgresEventStore(
      this.getOrCreateConnection(connectionSlug, connection).client as PostgresClient,
    );
  }

  getConnection(connectionSlug: string): IPostgresConnection | undefined {
    return this.#connections.get(connectionSlug);
  }

  getOrCreateConnection(
    connectionSlug: string,
    connection: z.infer<typeof PostgresConnectionSchema>,
  ): IPostgresConnection {
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
    client: IPostgresClient,
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
