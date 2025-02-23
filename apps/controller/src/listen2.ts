import { appInjector } from "@/injector.ts";
import { DataStoreService } from "@/data-store/data-store.service.ts";
import { PostgresChanges } from "@/connection/postgres/postgres-changes.ts";

const dataStoreService = appInjector.injectClass(DataStoreService);
const postgresChanges = appInjector.injectClass(PostgresChanges);

const dataStores = await dataStoreService.getAll("bla");

for (const dataStore of dataStores) {
  if (dataStore.slug !== "server-two") {
    continue;
  }

  console.log(dataStore);

  console.log("starting postgres changes");
  const startResult = await postgresChanges.start(
    dataStore.connectionConfig,
    dataStore.publicationName,
  );
  console.log("returned from start", startResult.status);

  appInjector.dispose();
  break;
}
