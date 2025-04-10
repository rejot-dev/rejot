import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { JsonSchema } from "./json-schema/json-schema";

type ValidationResult =
  | {
      success: true;
    }
  | {
      success: false;
      errors: string[];
    };

export interface ISchemaLike {
  name: string;
  version: {
    major: number;
    minor: number;
  };
  outputSchema: JsonSchema;
}

export class SchemaValidator {
  #ajv: Ajv;

  constructor() {
    this.#ajv = new Ajv();

    // Some of the formats of ajv-formats are implemented using regexes, which is not safe to run on untrusted data.
    // https://ajv.js.org/security.html#redos-attack
    // Formats below are not implemented using regexes, I checked this by inspecting the source code below.
    // (Note the version number in the URL!)
    // https://github.com/ajv-validator/ajv-formats/blob/v3.0.1/src/formats.ts
    addFormats(this.#ajv, [
      "date",
      "time",
      "date-time",
      "iso-time",
      "iso-date-time",
      "int32",
      "int64",
      "float",
      "double",
    ]);
  }

  #schemaKeyToString(schema: ISchemaLike): string {
    return `${schema.name}:${schema.version.major}.${schema.version.minor}`;
  }

  /**
   * Validates an object against a jsonschema.
   * jsonschema only supports primitive types like numbers and strings, in order to validate complex types like dates,
   * we need to serialize objects to JSON first, then run the validator.
   *
   * @param schemaKey - The name of the schema, used as a cache key for compiled validators
   * @param schema - The schema to validate against.
   * @param object - The object to validate.
   */
  validate(schema: ISchemaLike, object: Record<string, unknown>): ValidationResult {
    const key = this.#schemaKeyToString(schema);
    const validator =
      this.#ajv.getSchema(key) ?? this.#ajv.addSchema(schema.outputSchema, key).getSchema(key);

    if (!validator) {
      throw new Error(`Schema validator not found for ${key}`);
    }

    /* 
    The output schema we define in jsonschema for public/consumer schemas defines the schema of 
    the serialized data, not the in-memory JavaScript object. Therefore we must serialize any objects
    we want to validate against the schema.

    Example:
    In Postgres we have a TIMESTAMP column, after applying the public schema transformation this becomes a Date() object.
      operation: {date: Date(2021, 1, 1)}
    This is stored in the eventstore as a JSONB column, there the column is serialized as a ISO8601 string.
      operation: {date: "2021-01-01T00:00:00.000Z"}
    Our jsonschema defines this column as of type string, with a "date-time" format. This is what the validation checks:
      validate({ type: "string", format: "date-time"}, { date: "2021-01-01T00:00:00.000Z" })
    */

    // TODO: Validate against serialized objects, don't perform the serialization here (again).
    const result = validator(JSON.parse(JSON.stringify(object)));
    if (!result) {
      if (!validator.errors) {
        throw new Error("Validation failed but no errors are reported");
      }
      return {
        success: false,
        errors: validator.errors.map(
          (error) => `${key}${error.instancePath ?? "/"}: ${error.message ?? "unknown error"}`,
        ),
      };
    }

    return {
      success: true,
    };
  }
}
