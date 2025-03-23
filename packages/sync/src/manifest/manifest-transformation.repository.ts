import { z } from "zod";
import { SyncManifestSchema, type PublicSchemaSchema } from "@rejot/contract/manifest";
import type { TableOperation } from "@rejot/contract/sync";
import type { IPublicSchemaTransformationRepository } from "@rejot/contract/public-schema";
type Manifest = z.infer<typeof SyncManifestSchema>;

export class ManifestTransformationRepository implements IPublicSchemaTransformationRepository {
  readonly #manifests: Manifest[];

  constructor(manifests: Manifest[]) {
    this.#manifests = manifests;
  }

  getPublicSchemasForOperation(
    dataStoreSlug: string,
    operation: TableOperation,
  ): Promise<z.infer<typeof PublicSchemaSchema>[]> {
    // Find all public schemas that use this datastore
    const relevantSchemas = this.#manifests.flatMap((manifest) =>
      manifest.publicSchemas.filter(
        (schema) =>
          schema.source.dataStoreSlug === dataStoreSlug &&
          schema.source.tables.includes(operation.table),
      ),
    );

    // Group schemas by name and major version
    const schemasByNameAndMajor = new Map<
      string,
      Map<number, (typeof relevantSchemas)[number][]>
    >();

    for (const schema of relevantSchemas) {
      if (!schemasByNameAndMajor.has(schema.name)) {
        schemasByNameAndMajor.set(schema.name, new Map());
      }
      const versionMap = schemasByNameAndMajor.get(schema.name)!;

      if (!versionMap.has(schema.version.major)) {
        versionMap.set(schema.version.major, []);
      }
      versionMap.get(schema.version.major)!.push(schema);
    }

    // For each name and major version, get the schema with highest minor version
    const latestSchemas = Array.from(schemasByNameAndMajor.values()).flatMap((versionMap) =>
      Array.from(versionMap.values()).map((schemas) =>
        schemas.reduce((latest, current) =>
          current.version.minor > latest.version.minor ? current : latest,
        ),
      ),
    );

    return Promise.resolve(latestSchemas);
  }
}
