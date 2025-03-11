#!/bin/bash

set -e


case "$REJOT_APP" in
  "controller")
    echo "Starting controller webserver"
    # Run database migrations
    pushd apps/controller
    bun src/migrate.ts
    popd

    # Start the controller application
    exec bun run apps/controller/src/index.ts
    ;;
    
  "rejot-cli")
    exec bun run apps/rejot-cli/bin/run.js "$@"
    ;;
    
  *)
    echo "Unknown app type: $REJOT_APP"
    echo "Supported values: controller, rejot-cli"
    exit 1
    ;;
esac
