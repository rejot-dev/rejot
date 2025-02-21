import { Link, NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConnections } from "@/data/connection/connection.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
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
import { PlusCircle } from "lucide-react";
import { ConnectionHealthStatus } from "./components/connection-health-status";

export function ConnectionOverview() {
  const organizationId = useSelectedOrganizationCode();
  const { data: connections, isLoading } = useConnections(organizationId ?? "");

  if (!organizationId) {
    return null;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

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
                <BreadcrumbPage>Connections</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="mb-2 text-3xl font-bold tracking-tight">Connections</h2>
            <p className="text-muted-foreground text-lg">Manage your database connections</p>
          </div>
          <Button asChild>
            <Link to="new" className="gap-2">
              <PlusCircle className="size-4" />
              Create Connection
            </Link>
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Database</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections?.map((connection) => (
                <TableRow key={connection.slug}>
                  <TableCell>{connection.slug}</TableCell>
                  <TableCell>{connection.config.type}</TableCell>
                  <TableCell>{connection.config.database}</TableCell>
                  <TableCell>{connection.config.host}</TableCell>
                  <TableCell>
                    <ConnectionHealthStatus
                      organizationId={organizationId}
                      connectionSlug={connection.slug}
                    />
                  </TableCell>
                  <TableCell>
                    <Link to={`/connections/${connection.slug}`}>More Info</Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
