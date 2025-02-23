import { appInjector } from "@/injector.ts";
import { DataStoreService } from "@/data-store/data-store.service.ts";
import { PostgresChanges } from "@/connection/postgres/postgres-changes.ts";

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: bun run entrypoint-syncer.ts <system>");
  process.exit(1);
}

const system = args[0];
const dataStoreService = appInjector.injectClass(DataStoreService);
const postgresChanges = appInjector.injectClass(PostgresChanges);

const dataStores = await dataStoreService.getAll(system);

// Start all datastores in parallel
await Promise.all(
  dataStores.map(async (dataStore) => {
    console.log(`Starting postgres changes for ${dataStore.slug}`);
    const startResult = await postgresChanges.start({
      organizationId: dataStore.organization.id,
      dataStoreSlug: dataStore.slug,
      config: dataStore.connectionConfig,
      publicationName: dataStore.publicationName,
    });
    console.log(`Returned from start for ${dataStore.slug}:`, startResult.status);
  }),
);

appInjector.dispose();
