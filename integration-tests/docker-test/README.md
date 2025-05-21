# Docker Test

```bash
docker-compose run --rm bun-local bash
```

- `rejot-cli manifest init --slug "rejot-test-"`
- `rejot-cli manifest connection add --slug source --connection-string $REJOT_DB_1`
- `rejot-cli manifest connection add --slug sink --connection-string $REJOT_DB_2`
- `rejot-cli manifest datastore add --connection source --publication my_rejot_publication --slot my_rejot_slot`
- `rejot-cli collect --write data/example-schema.ts`

- `apt update && apt install postgresql-client`

# Initialize source and sink databases

After installing the PostgreSQL client, run the following commands to create the tables:

```bash
psql "$REJOT_DB_1" -f data/source-init.sql
psql "$REJOT_DB_2" -f data/sink-init.sql
```

# Run sync

```bash
rejot-cli manifest sync --log-level=trace ./rejot-manifest.json
```

# Insert test data (from outside the container)

```bash
docker-compose exec -u postgres -it postgres_source psql -f data/insert-account.sql
```

# Query sink table (from outside the container)

```bash
docker-compose exec -u postgres -it postgres_sink psql -f data/select-account.sql
```

# Stop & Delete

```bash
docker-compose rm -fs
```
