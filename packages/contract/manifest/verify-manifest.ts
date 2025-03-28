import { z } from "zod";
import { SyncManifestSchema } from "./manifest";

export type ManifestError = {
  type: "CONNECTION_NOT_FOUND" | "PUBLIC_SCHEMA_NOT_FOUND" | "VERSION_MISMATCH";
  message: string;
  location: {
    manifestSlug: string;
    context?: string;
  };
  hint?: {
    message: string;
    suggestions?: string;
  };
};

export type VerificationResult = {
  isValid: boolean;
  errors: ManifestError[];
};

/**
 * Verifies that all connections referenced by dataStores and eventStores exist within the manifest
 */
export function verifyConnectionReferences(
  manifest: z.infer<typeof SyncManifestSchema>,
): ManifestError[] {
  const errors: ManifestError[] = [];
  const connectionSlugs = new Set(manifest.connections.map(({ slug }) => slug));

  // Verify dataStore connections
  manifest.dataStores.forEach((dataStore, index) => {
    if (!connectionSlugs.has(dataStore.connectionSlug)) {
      errors.push({
        type: "CONNECTION_NOT_FOUND",
        message: `DataStore references connection '${dataStore.connectionSlug}' which does not exist in the manifest`,
        location: {
          manifestSlug: manifest.slug,
          context: `dataStore.connectionSlug[${index}]: ${dataStore.connectionSlug}`,
        },
        hint: {
          message:
            "Check that the connection slug is correct and that the connection is defined in the manifest",
          suggestions: `Available connections: ${Array.from(connectionSlugs).join(", ")}`,
        },
      });
    }
  });

  // Verify eventStore connections
  manifest.eventStores.forEach((eventStore, index) => {
    if (!connectionSlugs.has(eventStore.connectionSlug)) {
      errors.push({
        type: "CONNECTION_NOT_FOUND",
        message: `EventStore references connection '${eventStore.connectionSlug}' which does not exist in the manifest`,
        location: {
          manifestSlug: manifest.slug,
          context: `eventStore.connectionSlug[${index}]: ${eventStore.connectionSlug}`,
        },
        hint: {
          message:
            "Check that the connection slug is correct and that the connection is defined in the manifest",
          suggestions: `Available connections: ${Array.from(connectionSlugs).join(", ")}`,
        },
      });
    }
  });

  return errors;
}

/**
 * Verifies that all public schemas referenced by consumer schemas exist and version compatibility
 */
export function verifyPublicSchemaReferences(
  manifests: z.infer<typeof SyncManifestSchema>[],
): ManifestError[] {
  const errors: ManifestError[] = [];

  // Build a map of all available public schemas across all manifests
  const publicSchemaMap = new Map<string, Map<string, number[]>>();
  manifests.forEach((manifest) => {
    manifest.publicSchemas.forEach((schema) => {
      if (!publicSchemaMap.has(manifest.slug)) {
        publicSchemaMap.set(manifest.slug, new Map());
      }
      const manifestSchemas = publicSchemaMap.get(manifest.slug)!;
      if (!manifestSchemas.has(schema.name)) {
        manifestSchemas.set(schema.name, []);
      }
      manifestSchemas.get(schema.name)!.push(schema.version.major);
    });
  });

  // Verify consumer schema references
  manifests.forEach((manifest) => {
    manifest.consumerSchemas.forEach((consumerSchema) => {
      const sourceManifestSchemas = publicSchemaMap.get(consumerSchema.sourceManifestSlug);

      if (!sourceManifestSchemas) {
        errors.push({
          type: "PUBLIC_SCHEMA_NOT_FOUND",
          message: `Consumer schema references manifest '${consumerSchema.sourceManifestSlug}' which does not exist`,
          location: {
            manifestSlug: manifest.slug,
            context: `consumerSchema.sourceManifestSlug: ${consumerSchema.sourceManifestSlug}`,
          },
        });
        return;
      }

      const availableVersions = sourceManifestSchemas.get(consumerSchema.publicSchema.name);
      if (!availableVersions) {
        errors.push({
          type: "PUBLIC_SCHEMA_NOT_FOUND",
          message: `Consumer schema references public schema '${consumerSchema.publicSchema.name}' which does not exist in manifest '${consumerSchema.sourceManifestSlug}'`,
          location: {
            manifestSlug: manifest.slug,
            context: `consumerSchema.publicSchema.name: ${consumerSchema.publicSchema.name}`,
          },
        });
        return;
      }

      // Version compatibility check
      if (!availableVersions.includes(consumerSchema.publicSchema.majorVersion)) {
        errors.push({
          type: "VERSION_MISMATCH",
          message: `Consumer schema requires version ${consumerSchema.publicSchema.majorVersion} of public schema '${consumerSchema.publicSchema.name}', but available versions are: ${availableVersions.join(", ")}`,
          location: {
            manifestSlug: manifest.slug,
            context: `consumerSchema.publicSchema (name: ${consumerSchema.publicSchema.name}, version: ${consumerSchema.publicSchema.majorVersion})`,
          },
        });
      }
    });
  });

  return errors;
}

/**
 * Main verification function that performs all checks on multiple manifests
 */
export function verifyManifests(
  manifests: z.infer<typeof SyncManifestSchema>[],
  checkPublicSchemaReferences = true,
): VerificationResult {
  const errors: ManifestError[] = [];

  // Verify each individual manifest
  manifests.forEach((manifest) => {
    // Verify internal connection references
    errors.push(...verifyConnectionReferences(manifest));
  });

  // Verify cross-manifest references, only works if all manifests are provided.
  // The sync manifest controller might have a subset and therefore cannot verify public schema references here
  if (checkPublicSchemaReferences) {
    errors.push(...verifyPublicSchemaReferences(manifests));
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
