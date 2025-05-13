# Docker Test

```bash
docker-compose run --rm bun-test bash
```

- `rejot-cli manifest connection add --slug source --connection-string $REJOT_DB_1`
- `rejot-cli manifest connection add --slug sink --connection-string $REJOT_DB_2`
- `rejot-cli manifest datastore add --connection source --publication my_rejot_publication --slot my_rejot_slot`
