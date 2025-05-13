import jsonPointer from "json-pointer";
const { get: getPath } = jsonPointer;

/* This is AI generated, don't ask me how it works. */

// Minimal JSON Schema interface for this usage
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  $ref?: string;
  anyOf?: JSONSchema[];
  items?: JSONSchema;
  description?: string;
  title?: string;
  enum?: unknown[];
  const?: unknown;
  [key: string]: unknown;
}

export type SchemaItem =
  | {
      type: "key";
      key: string;
      valueType: string;
      required: boolean;
      description: string;
      enumValues?: unknown[];
      constValue?: unknown;
    }
  | {
      type: "ref";
      key: string;
      valueType: string; // "string" or "object" or "object | object" or "array[string]"
      valueRefName: string;
      valueRef: string;
      required: boolean;
      description: string;
      enumValues?: unknown[];
      constValue?: unknown;
    };

/**
 * Resolves a JSON pointer string (e.g., "#/path/to/field") within a schema.
 * Returns the targeted sub-schema object or null.
 */
export function resolveRef(ref: string, baseSchema: JSONSchema): JSONSchema | null {
  if (!ref || !ref.startsWith("#/")) {
    console.warn(`Invalid or unsupported ref: ${ref}`);
    return null;
  }
  try {
    // Handle root reference specifically vs other paths
    const pointer = ref === "#/" ? "" : ref.substring(1); // Use "" for root, remove just '#' for others
    return getPath(baseSchema, pointer) as JSONSchema;
  } catch (e) {
    console.error(`Error resolving $ref "${ref}":`, e);
    return null;
  }
}

/**
 * Extracts a list of SchemaItem objects from a sub-schema (e.g., each property in an object).
 */
export function extractSchemaItems(subSchema: JSONSchema, baseSchema: JSONSchema): SchemaItem[] {
  let targetSchema = subSchema;

  // Handle top-level anyOf: Find the first object schema within anyOf
  if (subSchema?.anyOf && Array.isArray(subSchema.anyOf)) {
    const objectSchema = subSchema.anyOf.find(
      (s: JSONSchema) => s.type === "object" && s.properties,
    );
    if (objectSchema) {
      targetSchema = objectSchema; // Use this schema to extract properties
    } else {
      // If no suitable object schema is found, log a warning and return empty.
      console.warn("Schema is anyOf but contains no object with properties:", subSchema);
      return [];
    }
  }

  // Proceed with existing logic using the resolved targetSchema
  if (!targetSchema || !targetSchema.properties) {
    // Log the schema that failed the check (could be the original or from anyOf)
    console.warn("Schema does not have properties or is not an object:", targetSchema);
    return [];
  }

  const items: SchemaItem[] = [];
  // Use targetSchema for properties and required keys
  const { properties = {}, required = [] } = targetSchema;
  const requiredKeys = new Set(required);

  for (const key of Object.keys(properties)) {
    const propDef = properties[key];
    const description = propDef.description || "";
    const isRequired = requiredKeys.has(key);
    let valueType = propDef.type ?? "any";
    let isRef = false;
    let valueRef = "";
    let valueRefName = "";
    let enumValues = propDef.enum;
    let constValue = propDef.const;

    // Handle reference to the JSON Schema meta-schema
    if (propDef.$ref === "http://json-schema.org/draft-07/schema#") {
      valueType = "JsonSchema";
      isRef = false; // Treat as a specific type, not a general ref
    }
    // Object reference
    else if (propDef.type === "object" && propDef.$ref) {
      isRef = true;
      valueRef = propDef.$ref;
      const resolvedRef = resolveRef(valueRef, baseSchema);
      valueRefName = resolvedRef?.title || valueRef.split("/").pop() || valueRef;
    }
    // Array reference
    else if (propDef.type === "array" && propDef.items?.$ref) {
      valueType = "array";
      isRef = true;
      valueRef = propDef.items.$ref;
      const resolvedRef = resolveRef(valueRef, baseSchema);
      valueRefName = resolvedRef?.title || valueRef.split("/").pop() || valueRef;
    }
    // Simple array - check item type more carefully
    else if (propDef.type === "array") {
      const itemsDef = propDef.items;
      if (
        itemsDef?.type === "object" ||
        (itemsDef?.anyOf && itemsDef.anyOf.some((s) => s.type === "object"))
      ) {
        // Array of complex objects (inline or anyOf)
        valueType = "array[object]";
      } else {
        // Array of simple types or refs (refs handled above)
        valueType = `array[${itemsDef?.type ?? "any"}]`;
      }
      // Check for enum in array items
      if (itemsDef?.enum) {
        enumValues = itemsDef.enum;
      }
      // Check for const in array items
      if (itemsDef?.const !== undefined) {
        constValue = itemsDef.const;
      }
    }
    // anyOf union (non-array)
    else if (propDef.anyOf) {
      valueType = propDef.anyOf
        .map((option) =>
          option.$ref
            ? resolveRef(option.$ref, baseSchema)?.title || option.$ref.split("/").pop()
            : option.type,
        )
        .filter(Boolean)
        .join(" | ");
    }

    if (isRef) {
      items.push({
        type: "ref",
        key,
        valueType: propDef.type ?? "object",
        valueRefName,
        valueRef,
        required: isRequired,
        description,
        enumValues,
        constValue,
      });
    } else {
      items.push({
        type: "key",
        key,
        valueType,
        required: isRequired,
        description,
        enumValues,
        constValue,
      });
    }
  }
  return items;
}
