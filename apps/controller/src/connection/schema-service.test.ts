/* eslint-disable @typescript-eslint/no-explicit-any */

import { test, expect } from "bun:test";
import { SchemaService } from "./schema-service.ts";
import type {
  ColumnSchema,
  ConnectionTableSchemaChange,
} from "@rejot-dev/api-interface-controller/connection-health";

test("SchemaService.compareSchemas", async () => {
  // Create a minimal SchemaService instance for testing the private method
  const service = new SchemaService({} as any, {} as any, {} as any);

  // Access the private method using any type assertion
  const compareSchemas = (service as any).compareSchemas.bind(service);
  const idCol = {
    columnName: "id",
    dataType: "integer",
    isNullable: false,
    columnDefault: null,
    tableSchema: "public",
  };
  const nameCol = {
    columnName: "name",
    dataType: "text",
    isNullable: true,
    columnDefault: null,
    tableSchema: "public",
  };
  const emailCol = {
    columnName: "email",
    dataType: "text",
    isNullable: false,
    columnDefault: null,
    tableSchema: "public",
  };

  test("detects added columns", () => {
    const oldSchema: Record<string, ColumnSchema> = {
      id: idCol,
    };

    const newSchema: Record<string, ColumnSchema> = {
      id: idCol,
      name: nameCol,
    };

    const result = compareSchemas(oldSchema, newSchema);
    expect(result.changes.length).toBe(1);
    expect(result.changes[0].changeType).toBe("column_added");
    expect(result.changes[0].column).toBe("name");
    expect(result.changes[0].newValue).toBe("text");
  });

  test("detects removed columns", () => {
    const oldSchema: Record<string, ColumnSchema> = {
      id: idCol,
      name: nameCol,
    };
    const newSchema: Record<string, ColumnSchema> = {
      id: idCol,
    };

    const result = compareSchemas(oldSchema, newSchema);
    expect(result.changes.length).toBe(1);
    expect(result.changes[0].changeType).toBe("column_removed");
    expect(result.changes[0].column).toBe("name");
    expect(result.changes[0].oldValue).toBe("text");
  });

  test("detects type changes", () => {
    const oldSchema: Record<string, ColumnSchema> = {
      id: idCol,
    };

    const newSchema: Record<string, ColumnSchema> = {
      id: { ...idCol, dataType: "bigint" },
    };

    const result = compareSchemas(oldSchema, newSchema);
    expect(result.changes.length).toBe(1);
    expect(result.changes[0].changeType).toBe("type_changed");
    expect(result.changes[0].column).toBe("id");
    expect(result.changes[0].oldValue).toBe("integer");
    expect(result.changes[0].newValue).toBe("bigint");
  });

  test("detects nullability changes", () => {
    const oldSchema: Record<string, ColumnSchema> = {
      name: { ...nameCol, isNullable: true },
    };

    const newSchema: Record<string, ColumnSchema> = {
      name: { ...nameCol, isNullable: false },
    };

    const result = compareSchemas(oldSchema, newSchema);
    expect(result.changes.length).toBe(1);
    expect(result.changes[0].changeType).toBe("nullability_changed");
    expect(result.changes[0].column).toBe("name");
    expect(result.changes[0].oldValue).toBe("true");
    expect(result.changes[0].newValue).toBe("false");
  });

  test("detects default value changes", () => {
    const oldSchema: Record<string, ColumnSchema> = {
      name: { ...nameCol, columnDefault: "now()" },
    };

    const newSchema: Record<string, ColumnSchema> = {
      name: { ...nameCol, columnDefault: null },
    };

    const result = compareSchemas(oldSchema, newSchema);
    expect(result.changes.length).toBe(1);
    expect(result.changes[0].changeType).toBe("default_changed");
    expect(result.changes[0].column).toBe("status");
    expect(result.changes[0].oldValue).toBe("now()");
    expect(result.changes[0].newValue).toBe(null);
  });

  test("detects multiple changes at once", () => {
    const oldSchema: Record<string, ColumnSchema> = {
      id: idCol,
      name: nameCol,
    };

    const newSchema: Record<string, ColumnSchema> = {
      id: { ...idCol, dataType: "bigint" },
      email: { ...emailCol, isNullable: false },
    };

    const result = compareSchemas(oldSchema, newSchema);
    expect(result.changes.length).toBe(3);

    // Type change for id
    const typeChange = result.changes.find(
      (c: ConnectionTableSchemaChange) => c.changeType === "type_changed",
    );
    expect(typeChange?.column).toBe("id");
    expect(typeChange?.oldValue).toBe("integer");
    expect(typeChange?.newValue).toBe("bigint");

    // Removal of name
    const removeChange = result.changes.find(
      (c: ConnectionTableSchemaChange) => c.changeType === "column_removed",
    );
    expect(removeChange?.column).toBe("name");
    expect(removeChange?.oldValue).toBe("text");

    // Addition of email
    const addChange = result.changes.find(
      (c: ConnectionTableSchemaChange) => c.changeType === "column_added",
    );
    expect(addChange?.column).toBe("email");
    expect(addChange?.newValue).toBe("text");
  });

  test("returns empty changes for identical schemas", () => {
    const schema: Record<string, ColumnSchema> = {
      id: idCol,
    };

    const result = compareSchemas(schema, schema);
    expect(result.changes.length).toBe(0);
  });
});
