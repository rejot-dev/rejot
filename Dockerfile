FROM oven/bun:1.2.1 AS base

FROM base AS install
WORKDIR /install

# Top level dependencies
COPY package.json bun.lock .npmrc ./

# Workspace dependencies
# bun.lock is based on all workspace packages, so all must be included for controller build
COPY apps/controller-spa/package.json apps/controller-spa/package.json
COPY apps/controller/package.json apps/controller/package.json
COPY packages/api-interface-controller/package.json packages/api-interface-controller/package.json

RUN bun install --filter ./apps/controller --production --no-progress

FROM base AS release
WORKDIR /opt
COPY --from=install /install/node_modules /opt/node_modules 
COPY . /opt

USER bun
ENTRYPOINT [ "bun", "run", "apps/controller/src/index.ts" ]
