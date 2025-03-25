import logger from "@rejot/contract/logger";

const log = logger.createLogger("sync-service-resolver");

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
