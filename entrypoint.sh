#!/bin/bash

set -e

# Run database migrations
pushd apps/controller
bun src/migrate.ts
popd

# Start the application
exec bun run apps/controller/src/index.ts
