import { useParams } from "react-router";
import {
  useConnectionPublicationTableOverview,
  useConnectionSchemaOverview,
} from "@/data/table-schema/table-schema.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { TableRelationshipDiagram } from "./table-relationship-diagram";

export type TableColumn = {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  tableSchema: string;
  foreignKey?: {
    constraintName: string;
    referencedTableSchema: string;
    referencedTableName: string;
    referencedColumnName: string;
  };
};

export type TableOverview = {
  tables: Array<{
    tableName: string;
    schema: string;
    columns: Array<TableColumn>;
  }>;
};

export function PublicationTableOverview() {
  const { systemSlug, dataStoreSlug, publicationName } = useParams();
  const organizationId = useSelectedOrganizationCode();

  if (!systemSlug || !dataStoreSlug || !organizationId || !publicationName) {
    return <div>404: Data store not found</div>;
  }

  const { data, isLoading, isError, error } = useConnectionPublicationTableOverview(
    organizationId,
    dataStoreSlug,
    publicationName,
  );

  if (isError) {
    return <div>Error: {error.message}</div>;
  }

  if (isLoading || !data) {
    return <div>Loading...</div>;
  }

  return (
    <div className="size-full">
      <TableRelationshipDiagram
        tableOverview={data}
        resourceName={publicationName}
        className="size-full shadow-md"
      />
    </div>
  );
}

export function SchemaTableOverview() {
  const { systemSlug, dataStoreSlug, schemaName } = useParams();
  const organizationId = useSelectedOrganizationCode();

  if (!systemSlug || !dataStoreSlug || !organizationId || !schemaName) {
    return <div>404: Data store not found</div>;
  }

  const { data, isLoading, isError, error } = useConnectionSchemaOverview(
    organizationId,
    dataStoreSlug,
    schemaName,
  );

  if (isError) {
    return <div>Error: {error.message}</div>;
  }

  if (isLoading || !data) {
    return <div>Loading...</div>;
  }

  return (
    <div className="size-full">
      <TableRelationshipDiagram
        tableOverview={data}
        resourceName={schemaName}
        className="size-full shadow-md"
      />
    </div>
  );
}
