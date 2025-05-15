import { z } from "zod";

import type { ManifestWithPath } from "../workspace/workspace.ts";
import { SyncManifestSchema } from "./manifest.ts";

export type ManifestDiagnosticSeverity = "error" | "warning";

export type ManifestDiagnostic = {
  type:
    | "CONNECTION_NOT_FOUND"
    | "CONNECTION_TYPE_MISMATCH"
    | "DATA_STORE_MISSING_CONFIG"
    | "DATA_STORE_NOT_FOUND"
    | "DUPLICATE_MANIFEST_SLUG"
    | "DUPLICATE_PUBLIC_SCHEMA"
    | "MANIFEST_NOT_FOUND"
    | "PUBLIC_SCHEMA_NOT_FOUND"
    | "UNUSED_CONNECTION"
    | "VERSION_MISMATCH";

  severity: ManifestDiagnosticSeverity;
  message: string;
  location: {
    manifestSlug: string;
    manifestPath?: string;
    context?: string;
  };
  hint?: {
    message: string;
    suggestions?: string;
  };
};

// Updated type structure for external references
export type ExternalPublicSchemaReference = {
  manifestSlug: string; // The slug of the external manifest being referenced
  publicSchema: {
    name: string; // The name of the public schema being referenced
    majorVersion: number; // The required major version of the public schema
  };
  referencedBy: {
    // Information about the consumer schema making the reference
    manifestSlug: string; // Slug of the manifest containing the consumer schema
  };
};

export type VerificationResult = {
  isValid: boolean; // isValid remains true if there are only external references, but no errors
  diagnostics: ManifestDiagnostic[];
  externalReferences: ExternalPublicSchemaReference[]; // Use the renamed type
};

/**
 * Verifies that all manifest slugs are unique
 */
function verifyManifestSlugUniqueness(
  manifests: z.infer<typeof SyncManifestSchema>[],
): ManifestDiagnostic[] {
  const errors: ManifestDiagnostic[] = [];
  const slugMap = new Map<string, z.infer<typeof SyncManifestSchema>>();

  manifests.forEach((manifest) => {
    if (slugMap.has(manifest.slug)) {
      errors.push({
        type: "DUPLICATE_MANIFEST_SLUG",
        severity: "error",
        message: `Manifest slug '${manifest.slug}' is already used by another manifest`,
        location: {
          manifestSlug: manifest.slug,
        },
        hint: {
          message: "Each manifest must have a unique slug",
          suggestions: "Change the slug of one of the manifests",
        },
      });
    }
    slugMap.set(manifest.slug, manifest);
  });

  return errors;
}

/**
 * Verifies that all connections referenced by dataStores and eventStores exist within the manifest
 */
function verifyConnectionReferences(
  manifest: z.infer<typeof SyncManifestSchema>,
): ManifestDiagnostic[] {
  const errors: ManifestDiagnostic[] = [];

  // Get all connection slugs
  const connectionSlugs = new Set((manifest.connections ?? []).map((c) => c.slug));

  // Create a map of connection slugs to their connection types for validation
  const connectionTypeMap = new Map<string, string>();
  (manifest.connections ?? []).forEach((connection) => {
    connectionTypeMap.set(connection.slug, connection.config.connectionType);
  });

  // Check data store references
  (manifest.dataStores ?? []).forEach((ds) => {
    if (!connectionSlugs.has(ds.connectionSlug)) {
      errors.push({
        type: "CONNECTION_NOT_FOUND",
        severity: "error",
        message: `Data store references connection '${ds.connectionSlug}' which does not exist`,
        location: {
          manifestSlug: manifest.slug,
          context: `dataStore.connectionSlug: ${ds.connectionSlug}`,
        },
        hint: {
          message: "Add the connection to the manifest before referencing it in a data store",
          suggestions: `Use 'rejot manifest connection add --slug ${ds.connectionSlug}' to add the connection`,
        },
      });
    } else {
      if (ds.config) {
        // Check if the connection type matches the data store config's connection type
        const connectionType = connectionTypeMap.get(ds.connectionSlug);
        const dataStoreConnectionType = ds.config.connectionType;

        if (connectionType !== dataStoreConnectionType) {
          errors.push({
            type: "CONNECTION_TYPE_MISMATCH",
            severity: "error",
            message: `Data store config has connection type '${dataStoreConnectionType}' but references connection '${ds.connectionSlug}' with type '${connectionType}'`,
            location: {
              manifestSlug: manifest.slug,
              context: `dataStore.connectionSlug: ${ds.connectionSlug}`,
            },
            hint: {
              message:
                "Ensure the data store config connection type matches the referenced connection type",
              suggestions: `Change the data store config connection type to '${connectionType}' or use a connection with matching type`,
            },
          });
        }
      } else {
        // This is fine. We only need a data store config when the store is being used a source.
      }
    }
  });

  // Check event store references
  (manifest.eventStores ?? []).forEach((es) => {
    if (!connectionSlugs.has(es.connectionSlug)) {
      errors.push({
        type: "CONNECTION_NOT_FOUND",
        severity: "error",
        message: `Event store references connection '${es.connectionSlug}' which does not exist`,
        location: {
          manifestSlug: manifest.slug,
          context: `eventStore.connectionSlug: ${es.connectionSlug}`,
        },
        hint: {
          message: "Add the connection to the manifest before referencing it in an event store",
          suggestions: `Use 'rejot manifest connection add --slug ${es.connectionSlug}' to add the connection`,
        },
      });
    }
  });

  // Check for unused connections
  (manifest.connections ?? []).forEach((connection) => {
    const isUsed = [...(manifest.dataStores ?? []), ...(manifest.eventStores ?? [])].some(
      (store) => store.connectionSlug === connection.slug,
    );
    if (!isUsed) {
      errors.push({
        type: "UNUSED_CONNECTION",
        severity: "warning",
        message: `Connection '${connection.slug}' is not used by any data store or event store`,
        location: {
          manifestSlug: manifest.slug,
          context: `connection.slug: ${connection.slug}`,
        },
        hint: {
          message: "Consider removing unused connections to keep the manifest clean",
          suggestions: `Use 'rejot manifest connection remove --slug ${connection.slug}' to remove the connection`,
        },
      });
    }
  });

  return errors;
}

/**
 * Verifies public schema references within the provided manifests.
 * Identifies references to manifests not included in the set.
 * Returns both validation errors and identified external references.
 */
export function verifyPublicSchemaReferences(
  manifests: ManifestWithPath[],
  checkExternalReferences: boolean = false,
): {
  errors: ManifestDiagnostic[];
  externalReferences: ExternalPublicSchemaReference[];
} {
  const errors: ManifestDiagnostic[] = [];
  const unresolvedExternalReferences: ExternalPublicSchemaReference[] = [];

  // Build a map of all available manifests for quick lookup
  const manifestMap = new Map<string, ManifestWithPath>();
  manifests.forEach((manifestWithPath) => {
    manifestMap.set(manifestWithPath.manifest.slug, manifestWithPath);
  });

  // Build a map of all available public schemas across all manifests
  const publicSchemaMap = new Map<string, Map<string, number[]>>();
  manifests.forEach(({ manifest }) => {
    manifest.publicSchemas?.forEach((schema) => {
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

  // Build a map of all data stores
  const dataStoreMap = new Map<string, Set<string>>();
  manifests.forEach(({ manifest }) => {
    const storeNames = new Set(manifest.dataStores?.map((ds) => ds.connectionSlug) ?? []);
    dataStoreMap.set(manifest.slug, storeNames);
  });

  // Build a map of data stores with configs
  const dataStoreConfigMap = new Map<string, Map<string, boolean>>();
  manifests.forEach(({ manifest }) => {
    if (!dataStoreConfigMap.has(manifest.slug)) {
      dataStoreConfigMap.set(manifest.slug, new Map());
    }
    const manifestDataStores = dataStoreConfigMap.get(manifest.slug)!;
    manifest.dataStores?.forEach((ds) => {
      manifestDataStores.set(ds.connectionSlug, !!ds.config);
    });
  });

  // Verify public schemas reference valid data stores
  manifests.forEach(({ manifest, path: manifestPath }) => {
    manifest.publicSchemas?.forEach((publicSchema, index) => {
      const manifestDataStores = dataStoreMap.get(manifest.slug);
      if (manifestDataStores && !manifestDataStores.has(publicSchema.source.dataStoreSlug)) {
        errors.push({
          type: "DATA_STORE_NOT_FOUND",
          severity: "error",
          message: `Public schema '${publicSchema.name}' references data store '${publicSchema.source.dataStoreSlug}' which does not exist in manifest '${manifest.slug}'`,
          location: {
            manifestSlug: manifest.slug,
            manifestPath,
            context: `publicSchemas[${index}].source.dataStoreSlug: ${publicSchema.source.dataStoreSlug}`,
          },
        });
      } else {
        // Check if the data store has a config
        const manifestDataStoreConfigs = dataStoreConfigMap.get(manifest.slug);
        const hasConfig = manifestDataStoreConfigs?.get(publicSchema.source.dataStoreSlug);
        if (manifestDataStoreConfigs?.has(publicSchema.source.dataStoreSlug) && !hasConfig) {
          errors.push({
            type: "DATA_STORE_MISSING_CONFIG",
            severity: "error",
            message:
              `Public schema '${publicSchema.name}' references data store ` +
              `'${publicSchema.source.dataStoreSlug}' which does not have a configuration.`,
            location: {
              manifestSlug: manifest.slug,
              manifestPath,
              context: `publicSchemas[${index}].source.dataStoreSlug: ${publicSchema.source.dataStoreSlug}`,
            },
            hint: {
              message: "Add a configuration to the data store",
              suggestions: "Define the required connection type and other configuration properties",
            },
          });
        }
      }
    });
  });

  // Verify consumer schema references
  manifests.forEach(({ manifest, path: manifestPath }) => {
    manifest.consumerSchemas?.forEach((consumerSchema) => {
      const sourceManifestWithPath = manifestMap.get(consumerSchema.sourceManifestSlug);
      const sourceManifestSchemas = publicSchemaMap.get(consumerSchema.sourceManifestSlug);

      if (!sourceManifestWithPath) {
        // This references an external manifest not included in the verification set.
        if (checkExternalReferences) {
          // If we're checking external references, report it as an error
          errors.push({
            type: "MANIFEST_NOT_FOUND",
            severity: "error",
            message: `Consumer schema '${consumerSchema.name}' references manifest '${consumerSchema.sourceManifestSlug}' which does not exist in the workspace`,
            location: {
              manifestSlug: manifest.slug,
              manifestPath,
              context: `consumerSchema.sourceManifestSlug: ${consumerSchema.sourceManifestSlug}`,
            },
            hint: {
              message: "Ensure all referenced manifests are included in the workspace",
            },
          });
        }

        // Record it as an external reference
        unresolvedExternalReferences.push({
          manifestSlug: consumerSchema.sourceManifestSlug,
          publicSchema: {
            name: consumerSchema.publicSchema.name,
            majorVersion: consumerSchema.publicSchema.majorVersion,
          },
          referencedBy: {
            manifestSlug: manifest.slug,
          },
        });
        return; // Continue to the next consumer schema
      }

      const availableVersions = sourceManifestSchemas?.get(consumerSchema.publicSchema.name);
      if (!availableVersions) {
        errors.push({
          type: "PUBLIC_SCHEMA_NOT_FOUND",
          severity: "error",
          message: `Consumer schema references public schema '${consumerSchema.publicSchema.name}' which does not exist in manifest '${consumerSchema.sourceManifestSlug}'`,
          location: {
            manifestSlug: manifest.slug,
            manifestPath,
            context: `consumerSchema.publicSchema.name: ${consumerSchema.publicSchema.name}`,
          },
        });
        return;
      }

      // Version compatibility check
      if (!availableVersions.includes(consumerSchema.publicSchema.majorVersion)) {
        errors.push({
          type: "VERSION_MISMATCH",
          severity: "error",
          message: `Consumer schema requires version ${consumerSchema.publicSchema.majorVersion} of public schema '${consumerSchema.publicSchema.name}', but available versions are: ${availableVersions.join(", ")}`,
          location: {
            manifestSlug: manifest.slug,
            manifestPath,
            context: `consumerSchema.publicSchema (name: ${consumerSchema.publicSchema.name}, version: ${consumerSchema.publicSchema.majorVersion})`,
          },
        });
      }

      // Check if referenced data store exists in ANY manifest
      // The destination data store could be in any manifest, not just the consumer's or source's
      let dataStoreFound = false;

      // Search across all manifests for the data store
      for (const [_manifestSlug, stores] of dataStoreMap.entries()) {
        if (stores.has(consumerSchema.config.destinationDataStoreSlug)) {
          dataStoreFound = true;
          break;
        }
      }

      if (!dataStoreFound) {
        errors.push({
          type: "DATA_STORE_NOT_FOUND",
          severity: "error",
          message: `Consumer schema references data store '${consumerSchema.config.destinationDataStoreSlug}' which does not exist in any manifest`,
          location: {
            manifestSlug: manifest.slug,
            manifestPath,
            context: `consumerSchema.destinationDataStoreSlug: ${consumerSchema.config.destinationDataStoreSlug}`,
          },
        });
      }
    });
  });

  return { errors, externalReferences: unresolvedExternalReferences };
}

/**
 * Verifies that all public schemas referenced by consumer schemas exist and version compatibility
 */
export function verifyPublicSchemaUniqueness(manifests: ManifestWithPath[]): ManifestDiagnostic[] {
  const errors: ManifestDiagnostic[] = [];

  // Build a map of public schemas & version to manifest slug
  const publicSchemaMapManifest = new Map<string, { slug: string; path: string }>();

  manifests.forEach(({ manifest, path: manifestPath }) => {
    manifest.publicSchemas?.forEach((schema, index) => {
      const key = `${schema.name}:${schema.version.major}.${schema.version.minor}`;
      const previous = publicSchemaMapManifest.get(key);
      if (previous) {
        errors.push({
          type: "DUPLICATE_PUBLIC_SCHEMA",
          severity: "error",
          message: `Public schema '${schema.name}' version ${schema.version.major}.${schema.version.minor} already defined in manifest '${previous.slug}'`,
          location: {
            manifestSlug: manifest.slug,
            manifestPath,
            context: `publicSchemas[${index}] (name: ${schema.name}, version: ${schema.version.major}.${schema.version.minor})`,
          },
        });
      }
      publicSchemaMapManifest.set(key, { slug: manifest.slug, path: manifestPath });
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
  const errors: ManifestDiagnostic[] = [];

  // Check for duplicate manifest slugs
  errors.push(...verifyManifestSlugUniqueness(manifests));

  // Verify each individual manifest
  manifests.forEach((manifest) => {
    // Verify internal connection references
    errors.push(...verifyConnectionReferences(manifest));
  });

  // Convert manifests to ManifestWithPath format for cross-manifest checks
  const manifestsWithPath = manifests.map((manifest) => ({
    manifest,
    path: "",
  }));

  const publicSchemaReferencesResult = verifyPublicSchemaReferences(
    manifestsWithPath,
    checkPublicSchemaReferences,
  );

  // Verify cross-manifest references
  if (checkPublicSchemaReferences) {
    errors.push(...publicSchemaReferencesResult.errors);
  }

  errors.push(...verifyPublicSchemaUniqueness(manifestsWithPath));

  return {
    isValid: errors.filter((e) => e.severity === "error").length === 0, // Only errors affect validity, not warnings
    diagnostics: errors,
    externalReferences: publicSchemaReferencesResult.externalReferences,
  };
}

/**
 * Enhances diagnostics with file paths for workspace verification
 */
export function verifyManifestsWithPaths(
  manifests: ManifestWithPath[],
  checkPublicSchemaReferences = true,
): VerificationResult {
  // First verify the manifests without paths
  const baseResult = verifyManifests(
    manifests.map((m) => m.manifest),
    checkPublicSchemaReferences,
  );

  // Enhance the diagnostics with file paths
  const enhancedErrors = baseResult.diagnostics.map((error) => {
    const manifest = manifests.find((m) => m.manifest.slug === error.location.manifestSlug);
    if (manifest) {
      return {
        ...error,
        location: {
          ...error.location,
          manifestPath: manifest.path,
        },
      };
    }
    return error;
  });

  return {
    ...baseResult,
    diagnostics: enhancedErrors,
  };
}
