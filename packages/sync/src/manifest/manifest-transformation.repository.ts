import { z } from "zod";

import { type PublicSchemaSchema, SyncManifestSchema } from "@rejot-dev/contract/manifest";
import type { IPublicSchemaTransformationRepository } from "@rejot-dev/contract/public-schema";
import type { TableOperation } from "@rejot-dev/contract/sync";
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
      (manifest.publicSchemas ?? []).filter(
        (publicSchema) =>
          publicSchema.source.dataStoreSlug === dataStoreSlug &&
          (publicSchema.config.transformations ?? []).some(
            (transformation) => transformation.table === operation.table,
          ),
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
