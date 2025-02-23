import { useParams } from "react-router";
import { useConnectionPublicationTableOverview } from "@/data/publications/publications.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { TableRelationshipDiagram } from "./table-relationship-diagram";

export type DataStoreTableColumn = {
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

export type DataStoreTableOverview = {
  tables: Array<{
    tableName: string;
    schema: string;
    columns: Array<DataStoreTableColumn>;
  }>;
};

export function DataStoreTableOverview() {
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
      <TableRelationshipDiagram dataStoreOverview={data} className="size-full shadow-md" />
    </div>
  );
}
