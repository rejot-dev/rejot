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
import { useConnectionTables } from "@/data/connection/connection-health.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { Loader2 } from "lucide-react";

export function SchemaTableOverview() {
  const { connectionSlug } = useParams();
  const organizationId = useSelectedOrganizationCode();

  if (!connectionSlug || !organizationId) {
    return null;
  }

  const { data: tables, isLoading } = useConnectionTables(organizationId, connectionSlug);

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
                  <NavLink to={`/connections/${connectionSlug}`}>{connectionSlug}</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Tables</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Database Tables</h1>
          <p className="text-muted-foreground text-lg">
            View and manage tables in your database connection
          </p>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Schema</TableHead>
                <TableHead>Table Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center">
                    <Loader2 className="mx-auto size-4 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : !tables || tables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center">
                    No tables found
                  </TableCell>
                </TableRow>
              ) : (
                tables.map((table) => (
                  <TableRow key={`${table.schema}.${table.name}`}>
                    <TableCell>{table.schema}</TableCell>
                    <TableCell>
                      <NavLink
                        to={`/connections/${connectionSlug}/tables/${table.schema}.${table.name}`}
                        className="hover:underline"
                      >
                        {table.name}
                      </NavLink>
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
