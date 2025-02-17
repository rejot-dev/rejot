import { NavLink, useParams } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useConnectionTableSchema } from "@/data/connection/connection-health.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SchemaTableDetail() {
  const { connectionSlug, tableId } = useParams();
  const organizationId = useSelectedOrganizationCode();

  if (!connectionSlug || !organizationId || !tableId) {
    return null;
  }

  // tableId is in format "schema.table"
  const [schema, tableName] = tableId.split(".");
  if (!schema || !tableName) {
    return <div>Invalid table identifier</div>;
  }

  const { data: columns, isLoading } = useConnectionTableSchema(
    organizationId,
    connectionSlug,
    tableName,
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
                  <NavLink to="/connections">Connections</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <NavLink to={`/connections/${connectionSlug}`}>
                    {connectionSlug}
                  </NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{tableName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            {schema}.{tableName}
          </h1>
          <p className="text-lg text-muted-foreground">
            View table schema and column information
          </p>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column Name</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Default Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )
                : !columns || columns.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      No columns found
                    </TableCell>
                  </TableRow>
                )
                : (
                  columns.map((column) => (
                    <TableRow key={column.columnName}>
                      <TableCell>{column.columnName}</TableCell>
                      <TableCell>{column.dataType}</TableCell>
                      <TableCell>
                        <Badge variant={column.isNullable ? "secondary" : "outline"}>
                          {column.isNullable ? "NULL" : "NOT NULL"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {column.columnDefault === null
                          ? <span className="text-muted-foreground">none</span>
                          : (
                            column.columnDefault
                          )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
