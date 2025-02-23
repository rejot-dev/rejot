import { NavLink, useParams } from "react-router";
import {
  useConnectionPublicationTableOverview,
  useConnectionSchemaOverview,
} from "@/data/table-schema/table-schema.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { TableRelationshipDiagram } from "./table-relationship-diagram";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
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

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <NavLink to="/">Home</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <NavLink to={`/systems/${systemSlug}`}>{systemSlug}</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{dataStoreSlug}</BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{publicationName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="size-full">
        {isError ? (
          <div>Error: {error.message}</div>
        ) : isLoading || !data ? (
          <div>Loading...</div>
        ) : (
          <TableRelationshipDiagram
            tableOverview={data}
            resourceName={publicationName}
            className="size-full shadow-md"
          />
        )}
      </div>
    </>
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

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <NavLink to="/">Home</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <NavLink to={`/systems/${systemSlug}`}>{systemSlug}</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <BreadcrumbPage>{dataStoreSlug}</BreadcrumbPage>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{schemaName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="size-full">
        {isError ? (
          <div>Error: {error.message}</div>
        ) : isLoading ? (
          <div>Loading...</div>
        ) : data ? (
          <TableRelationshipDiagram
            tableOverview={data}
            resourceName={schemaName}
            className="size-full shadow-md"
          />
        ) : null}
      </div>
    </>
  );
}
