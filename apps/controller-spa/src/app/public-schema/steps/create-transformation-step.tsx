import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useCreatePublicSchemaMutation } from "@/data/public-schema/public-schema.data";
import { Loader2 } from "lucide-react";
import { useConnectionTableSchema } from "@/data/connection/connection-health.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { SchemaConfigurationEditor } from "../components/schema-configuration-editor";
import { postgresDataTypeToJsonType } from "@/lib/sql";
import { getTopLevelSelectedColumns } from "@/lib/sql";
import { SqlCodeMirror } from "../components/sql-code-mirror";

interface SchemaColumn {
  id: string;
  columnName: string;
  dataType: string;
}

interface CreateTransformationStepProps {
  systemSlug: string;
  dataStoreSlug: string;
  baseTable: string;
  onBack: () => void;
  onSuccess: (publicSchemaId: string) => void;
}

function defaultQuery(baseTable: PostgresTable, columns: string[]) {
  const quotedColumns = columns.map((col) => `"${col}"`);
  const columnsToSelect = quotedColumns.join(", ");

  const fromClause =
    baseTable.schema === "public" ? baseTable.name : `"${baseTable.schema}"."${baseTable.name}"`;

  if (columnsToSelect.length <= 70) {
    return `
SELECT
  ${columnsToSelect}
FROM
  ${fromClause}
WHERE
  id = $1
;
  `;
  }

  return `
SELECT
  ${quotedColumns.join(",\n  ")}
FROM
  ${fromClause}
WHERE
  id = $1
;
  `;
}

export type PostgresTable = {
  schema: string;
  name: string;
};

export function normalizePostgresTable(table: string): PostgresTable {
  const parts = table.split(".");
  if (parts.length === 1) {
    return {
      schema: "public",
      name: parts[0]!,
    };
  }

  if (parts.length !== 2) {
    throw new Error(`Invalid table name: ${table}`);
  }

  return {
    schema: parts[0]!,
    name: parts[1]!,
  };
}

export function CreateTransformationStep({
  systemSlug,
  dataStoreSlug,
  baseTable,
  onBack,
  onSuccess,
}: CreateTransformationStepProps) {
  const createMutation = useCreatePublicSchemaMutation();

  const organizationId = useSelectedOrganizationCode();

  const { data: tableColumns } = useConnectionTableSchema(organizationId, dataStoreSlug, baseTable);

  const table = normalizePostgresTable(baseTable);

  const { toast } = useToast();
  const [name, setName] = useState("");
  const [sqlQuery, setSqlQuery] = useState(
    defaultQuery(table, tableColumns?.map((col) => col.columnName) ?? []),
  );
  const [schema, setSchema] = useState<SchemaColumn[]>([]);

  useEffect(() => {
    setSqlQuery(defaultQuery(table, tableColumns?.map((col) => col.columnName) ?? []));
  }, [tableColumns]);

  // Get suggestions from table columns
  const tableSuggestions =
    tableColumns?.map((col) => ({
      columnName: col.columnName,
      dataType: postgresDataTypeToJsonType(col.dataType),
    })) ?? [];

  // Track existing column names
  const existingColumnNames = new Set(tableSuggestions.map((col) => col.columnName));

  // Get additional suggestions from SQL query
  const queryColumns = getTopLevelSelectedColumns(sqlQuery)
    .map((col) => col.replaceAll('"', ""))
    .filter((col) => col !== "*"); // Exclude wildcard

  const querySuggestions = queryColumns
    .filter((col) => !existingColumnNames.has(col))
    .map((col) => ({
      columnName: col,
      dataType: col.toLowerCase().includes("id") ? "number" : "string",
    }));

  const allSuggestions = [...tableSuggestions, ...querySuggestions];

  const handleCreate = async () => {
    if (!name || !sqlQuery) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (schema.length === 0) {
      toast({
        title: "Missing schema",
        description: "Please define at least one column in the schema",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        systemSlug,
        dataStoreSlug,
        data: {
          name,
          baseTable,
          schema: schema.map((col) => ({
            columnName: col.columnName,
            dataType: col.dataType,
            isNullable: true,
            default: null,
          })),
          details: {
            type: "postgresql",
            sql: sqlQuery,
          },
        },
      });
      toast({
        title: "Public schema created",
        description: "Your public schema has been created successfully",
      });

      onSuccess(result.id);
    } catch (error) {
      toast({
        title: "Error creating public schema",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Enter a name for your public schema"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium" htmlFor="sql">
              SQL Transformation
            </Label>
            <p className="text-muted-foreground max-w-prose text-sm">
              Enter a SQL query to transform the data from the base table. Placeholders for the
              primary key parts are <code>$1</code>, <code>$2</code>, etc. Using <code>*</code> is
              not recommended.
            </p>
            <SqlCodeMirror
              value={sqlQuery}
              onChange={setSqlQuery}
              baseTable={baseTable}
              tableColumns={tableColumns ?? []}
              className="h-[300px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Schema Configuration</Label>
            <p className="text-muted-foreground max-w-prose text-sm">
              Define the schema of this transformation, this is how your data will be published.
              Make sure these are in the same order as the columns in the SQL query. The names do
              not have to match.
            </p>
            <SchemaConfigurationEditor
              schema={schema}
              onChange={setSchema}
              suggestedColumns={allSuggestions}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleCreate} disabled={createMutation.isPending}>
          {createMutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Public Schema"
          )}
        </Button>
      </div>
    </div>
  );
}
