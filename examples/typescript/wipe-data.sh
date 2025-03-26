#!/bin/bash
set -ex

docker compose down

docker compose config --format json | jq -r '.volumes[] .name' | xargs docker volume rm

# Enable wal_level=logical
docker compose up db-accounts -d 

docker compose exec db-accounts sh -c 'echo "wal_level=logical" >> /var/lib/postgresql/data/postgresql.conf'

docker compose down db-accounts
