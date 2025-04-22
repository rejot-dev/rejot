import { z } from "zod";

import { SyncManifestSchema } from "./manifest.ts";

export type ManifestError = {
  type:
    | "CONNECTION_NOT_FOUND"
    | "PUBLIC_SCHEMA_NOT_FOUND"
    | "VERSION_MISMATCH"
    | "DUPLICATE_PUBLIC_SCHEMA";
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
  errors: ManifestError[];
  externalReferences: ExternalPublicSchemaReference[]; // Use the renamed type
};

/**
 * Verifies that all connections referenced by dataStores and eventStores exist within the manifest
 */
export function verifyConnectionReferences(
  manifest: z.infer<typeof SyncManifestSchema>,
): ManifestError[] {
  const errors: ManifestError[] = [];

  // Get all connection slugs
  const connectionSlugs = new Set((manifest.connections ?? []).map((c) => c.slug));

  // Check data store references
  (manifest.dataStores ?? []).forEach((ds) => {
    if (!connectionSlugs.has(ds.connectionSlug)) {
      errors.push({
        type: "CONNECTION_NOT_FOUND",
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
    }
  });

  // Check event store references
  (manifest.eventStores ?? []).forEach((es) => {
    if (!connectionSlugs.has(es.connectionSlug)) {
      errors.push({
        type: "CONNECTION_NOT_FOUND",
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

  return errors;
}

/**
 * Verifies public schema references within the provided manifests.
 * Identifies references to manifests not included in the set.
 * Returns both validation errors and identified external references.
 */
export function verifyPublicSchemaReferences(manifests: z.infer<typeof SyncManifestSchema>[]): {
  errors: ManifestError[];
  externalReferences: ExternalPublicSchemaReference[];
} {
  const errors: ManifestError[] = [];
  const unresolvedExternalReferences: ExternalPublicSchemaReference[] = [];

  // Build a map of all available public schemas across all manifests
  const publicSchemaMap = new Map<string, Map<string, number[]>>();
  manifests.forEach((manifest) => {
    (manifest.publicSchemas ?? []).forEach((schema) => {
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
    (manifest.consumerSchemas ?? []).forEach((consumerSchema) => {
      const sourceManifestSchemas = publicSchemaMap.get(consumerSchema.sourceManifestSlug);

      if (!sourceManifestSchemas) {
        // This references an external manifest not included in the verification set.
        // Record it as an external reference instead of erroring or skipping.
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

  return { errors, externalReferences: unresolvedExternalReferences }; // Return both errors and external references
}

/**
 * Verifies that all public schemas referenced by consumer schemas exist and version compatibility
 */
export function verifyPublicSchemaUniqueness(
  manifests: z.infer<typeof SyncManifestSchema>[],
): ManifestError[] {
  const errors: ManifestError[] = [];

  // Build a map of public schemas & version to manifest slug
  const publicSchemaMapManifest = new Map<string, string>();

  manifests.forEach((manifest) => {
    (manifest.publicSchemas ?? []).forEach((schema, index) => {
      const key = `${schema.name}:${schema.version.major}.${schema.version.minor}`;
      const previousManifest = publicSchemaMapManifest.get(key);
      if (previousManifest) {
        errors.push({
          type: "DUPLICATE_PUBLIC_SCHEMA",
          message: `Public schema '${schema.name}' version ${schema.version.major}.${schema.version.minor} already defined in manifest '${previousManifest}'`,
          location: {
            manifestSlug: manifest.slug,
            context: `publicSchemas[${index}] (name: ${schema.name}, version: ${schema.version.major}.${schema.version.minor})`,
          },
        });
      }
      publicSchemaMapManifest.set(key, manifest.slug);
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

  const publicSchemaReferencesResult = verifyPublicSchemaReferences(manifests);

  // Verify cross-manifest references
  if (checkPublicSchemaReferences) {
    errors.push(...publicSchemaReferencesResult.errors);
  }

  errors.push(...verifyPublicSchemaUniqueness(manifests));

  return {
    isValid: errors.length === 0, // Validity depends only on errors, not external references
    errors,
    externalReferences: publicSchemaReferencesResult.externalReferences,
  };
}
