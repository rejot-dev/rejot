import logger from "@rejot-dev/contract/logger";

const log = logger.createLogger("sync-service-resolver");

type LocalhostResolverOptions = {
  type: "localhost";
  apiPort: number;
};

type EnvResolverOptions = {
  type: "env";
};

type ResolverOptions = LocalhostResolverOptions | EnvResolverOptions;

export interface ISyncServiceResolver {
  resolve(manifestSlug: string): string;
}

class ResolveError extends Error {
  constructor(slug: string) {
    super(`Cannot resolve host for manifest slug '${slug}'`);
  }
}

export class LocalhostResolver implements ISyncServiceResolver {
  readonly #port: number;

  constructor(port: number) {
    log.warn(
      "LocalhostResolver is only intended for local development and only works with one sync service",
    );
    this.#port = port;
  }

  resolve(_manifestSlug: string): string {
    return `localhost:${this.#port}`;
  }
}

export class EnvResolver implements ISyncServiceResolver {
  /*
  Provide mapping of manifest slugs to hostnames through environment variables
    REJOT_SYNC_SERVICE_<slug>=<host>:<port>
  */

  readonly #slugToHost: Record<string, string>;

  constructor() {
    this.#slugToHost = {};

    for (const [key, host] of Object.entries(process.env)) {
      if (key.startsWith("REJOT_SYNC_SERVICE_")) {
        const slug = key.replace("REJOT_SYNC_SERVICE_", "");
        if (key.length === 0) {
          throw new Error(`${key} environment variable has empty slug!`);
        }
        if (!host) {
          throw new Error(`${key} environment variable has empty host!`);
        }
        this.#slugToHost[slug] = host;
      }
    }
  }

  resolve(manifestSlug: string): string {
    const host = this.#slugToHost[manifestSlug];
    if (!host) {
      throw new ResolveError(manifestSlug);
    }
    return host;
  }
}

export class StaticResolver implements ISyncServiceResolver {
  readonly #slugToHost: Record<string, string>;

  constructor(slugToHost: Record<string, string>) {
    this.#slugToHost = slugToHost;
  }

  resolve(manifestSlug: string): string {
    const host = this.#slugToHost[manifestSlug];
    if (!host) {
      throw new ResolveError(manifestSlug);
    }
    return host;
  }
}

export class K8sResolver implements ISyncServiceResolver {
  readonly #namespace: string;

  constructor(namespace: string) {
    this.#namespace = namespace;
  }

  resolve(manifestSlug: string): string {
    return `rejot-manifest-${manifestSlug}.${this.#namespace}.svc.cluster.local`;
  }
}

export function createResolver(options: ResolverOptions): ISyncServiceResolver {
  switch (options.type) {
    case "localhost":
      return new LocalhostResolver(options.apiPort);
    case "env":
      return new EnvResolver();
  }
}
