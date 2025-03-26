# Typescript Microservice Demo Application

## Setting up ReJot

### Setting up connections, datastores and eventstores

Make sure to enable wal_level=logical after creating your db

```bash
docker compose up db-accounts -d && \
docker compose exec db-accounts sh -c 'echo "wal_level=logical" >> /var/lib/postgresql/data/postgresql.conf' && \
docker compose restart db-accounts
```

Configuring data stores and their connections

```bash
cd /examples/typescript

bunx rejot-cli manifest init --slug "sync-a"
bunx rejot-cli manifest connection add --slug "db-accounts" --connection-string "postgres://postgres:postgres@db-accounts:5432/postgres"
bunx rejot-cli manifest connection add --slug "eventstore" --connection-string "postgres://postgres:postgres@eventstore:5432/postgres"
bunx rejot-cli manifest datastore add --connection db-accounts
bunx rejot-cli manifest eventstore add --connection eventstore
```

### Creating Public Schemas

Publishing schemas from accounts database.

```bash
cd /examples/typescript
bunx rejot-cli collect rejot-schemas.ts
```

### Starting the sync

Will start the sync service, only pushes to event store until consumer schema is setup.

```bash
docker compose up sync-a --build
```

### Creating Consumer Schemas

```bash
cd /examples/typescript
bunx rejot-cli manifest connection add --slug "db-orders" --connection-string "postgres://postgres:postgres@db-orders:5432/postgres"
bunx rejot-cli manifest datastore add --connection db-orders
```

## Debugging

psql into a database, for example in the event store:

```bash
docker compose exec eventstore psql -U postgres -d postgres
postgres=# select * from rejot_events.events;
```

Reset your local databases to a clean slate:

```bash
./wipe-data.sh
```

## Issues

- Updating rejot-schema.ts definition and forgetting to run collect.
- Schema issues with public schemas
  - All fields are nullable regardless of defined schema
  - Seems that the query result is written blindly to event store, no check that all fields are present
- Connection refused errors on SyncManifestController doesn't say which connection refused (eventstore/sources/etc)
- Connections might die intermittently
- Connection details can only be passed in manifest for now
