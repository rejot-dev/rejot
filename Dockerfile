FROM oven/bun:1.2.1 AS base
ARG REJOT_APP=controller
ENV REJOT_APP=${REJOT_APP}

FROM base AS install
WORKDIR /install

# Top level dependencies
COPY package.json bun.lock .npmrc ./

# Workspace dependencies
# bun.lock is based on all workspace packages, so all must be included for builds
COPY apps/controller-spa/package.json apps/controller-spa/package.json
COPY apps/controller/package.json apps/controller/package.json
COPY apps/rejot-cli/package.json apps/rejot-cli/package.json

COPY packages/api-interface-controller/package.json packages/api-interface-controller/package.json
COPY packages/contract/package.json packages/contract/package.json
COPY packages/sync/package.json packages/sync/package.json

RUN bun install --filter ./apps/${REJOT_APP} --production --no-progress

FROM base AS release
WORKDIR /opt
USER bun

COPY --from=install /install/node_modules /opt/node_modules 
COPY . /opt
COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT [ "/entrypoint.sh" ]
