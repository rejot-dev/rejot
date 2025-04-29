FROM oven/bun:1.2.6 AS base
ARG REJOT_APP=controller
ENV REJOT_APP=${REJOT_APP}

# Install curl for container health checks
RUN apt update && apt install -y curl && rm -rf /var/lib/apt/lists/*

FROM base AS install
WORKDIR /install

# Top level dependencies
COPY package.json bun.lock ./

# Workspace dependencies
# bun.lock is based on all workspace packages, so all must be included for builds
COPY apps/controller/package.json apps/controller/package.json
COPY apps/controller-spa/package.json apps/controller-spa/package.json
COPY apps/rejot-cli/package.json apps/rejot-cli/package.json
COPY apps/mcp/package.json apps/mcp/package.json
COPY apps/static-site/package.json apps/static-site/package.json

COPY packages/adapter-postgres/package.json packages/adapter-postgres/package.json
COPY packages/api-interface-controller/package.json packages/api-interface-controller/package.json
COPY packages/contract/package.json packages/contract/package.json
COPY packages/contract-tools/package.json packages/contract-tools/package.json
COPY packages/sync/package.json packages/sync/package.json
COPY packages/sqlparser/package.json packages/sqlparser/package.json
COPY integration-tests/one/package.json integration-tests/one/package.json

RUN bun install --filter ./apps/${REJOT_APP} --production --no-progress \
  || (echo "Hint: On lockfile is frozen error, ensure all workspace package.json files are copied into the Dockerfile!" && exit 1)

FROM base AS release
WORKDIR /opt
USER bun

COPY --from=install /install/node_modules /opt/node_modules
COPY . /opt
COPY entrypoint.sh /entrypoint.sh

USER root
RUN if [ "${REJOT_APP}" = "rejot-cli" ]; then \
    echo '#!/bin/bash\nexec bun run /opt/apps/rejot-cli/bin/run.js "$@"' > /usr/local/bin/rejot-cli && \
    chmod +x /usr/local/bin/rejot-cli; \
    fi
USER bun

ENTRYPOINT [ "/entrypoint.sh" ]
