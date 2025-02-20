import { createInjector } from "typed-inject";

import { PublicationService } from "./publication/publication-service.ts";
import { PostgresManager } from "./postgres/postgres.ts";
import { OrganizationRepository } from "./organization/organization-repository.ts";
import { OrganizationService } from "./organization/organization-service.ts";
import { OrganizationRoutes } from "./organization/organization-routes.ts";
import { ConfigManager } from "./app-config/config.ts";
import { PostgresChangelogListenerConnectionManager } from "./changelog/postgres/postgres-changelog-listener-connection-manager.ts";
import { PostgresChangelogListener } from "./changelog/postgres/postgres-changelog-listener.ts";
import { AuthenticationService } from "./authentication/authentication-service.ts";
import { AuthenticationRoutes } from "./authentication/authentication.routes.ts";
import { AuthenticationMiddleware } from "./authentication/authentication.middleware.ts";
import { ClerkApiClient } from "./clerk/clerk.api-client.ts";
import { ClerkPersonService } from "./clerk/clerk-person-service.ts";
import { ClerkRepository } from "./clerk/clerk-repository.ts";
import { ClerkRoutes } from "./clerk/clerk-routes.ts";
import { PersonRepository } from "./person/person-repository.ts";
import { SystemRepository } from "./system/system-repository.ts";
import { SystemService } from "./system/system-service.ts";
import { SystemRoutes } from "./system/system-routes.ts";
import { ConnectionRepository } from "./connection/connection-repository.ts";
import { ConnectionService } from "./connection/connection-service.ts";
import { ConnectionRoutes } from "./connection/connection-routes.ts";
import { ConnectionHealthRoutes } from "./connection/connection-health.routes.ts";
import { PostgresConnectionManager } from "./connection/postgres/postgres-connection-manager.ts";
import { SchemaService } from "./connection/schema-service.ts";
import { SchemaRepository } from "./connection/schema-repository.ts";
import { ConnectionTypeMultiplexer } from "./connection/connection-type-multiplexer.ts";
import { ConnectionRawRoutes } from "./connection/connection-raw.routes.ts";
import { PublicationRepository } from "./publication/publication-repository.ts";
import { PublicationRoutes } from "./publication/publication-routes.ts";

export const appInjector = createInjectionContainer();

export function createInjectionContainer() {
  const appInjector = createInjector()
    .provideClass("config", ConfigManager)
    .provideClass("postgres", PostgresManager)
    .provideClass("postgresDisposer", PostgresManager)
    .provideClass(
      "postgresChangelogListenerConnectionManager",
      PostgresChangelogListenerConnectionManager,
    )
    .provideClass("postgresChangelogListener", PostgresChangelogListener)
    // Repositories
    .provideClass("organizationRepository", OrganizationRepository)
    .provideClass("connectionRepository", ConnectionRepository)
    .provideClass("clerkRepository", ClerkRepository)
    .provideClass("personRepository", PersonRepository)
    .provideClass("postgresConnectionManager", PostgresConnectionManager)
    .provideClass("systemRepository", SystemRepository)
    .provideClass("schemaRepository", SchemaRepository)
    .provideClass("publicationRepository", PublicationRepository)
    // API Clients
    .provideClass("clerkApiClient", ClerkApiClient)
    .provideClass("connectionTypeMultiplexer", ConnectionTypeMultiplexer)
    // Services
    .provideClass("publicationService", PublicationService)
    .provideClass("authenticationService", AuthenticationService)
    .provideClass("connectionService", ConnectionService)
    .provideClass("organizationService", OrganizationService)
    .provideClass("clerkPersonService", ClerkPersonService)
    .provideClass("systemService", SystemService)
    .provideClass("schemaService", SchemaService)
    // Middleware
    .provideClass("authenticationMiddleware", AuthenticationMiddleware)
    // Routes
    .provideClass("authenticationRoutes", AuthenticationRoutes)
    .provideClass("organizationRoutes", OrganizationRoutes)
    .provideClass("clerkRoutes", ClerkRoutes)
    .provideClass("systemRoutes", SystemRoutes)
    .provideClass("connectionRoutes", ConnectionRoutes)
    .provideClass("connectionHealthRoutes", ConnectionHealthRoutes)
    .provideClass("connectionRawRoutes", ConnectionRawRoutes)
    .provideClass("publicationRoutes", PublicationRoutes);

  // Force disposer to be loaded.
  appInjector.resolve("postgresDisposer");

  return appInjector;
}
