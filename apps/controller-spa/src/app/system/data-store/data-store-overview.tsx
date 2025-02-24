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
import { useSystemDataStores } from "@/data/data-store/data-store.data";
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
import { PlusCircle, Database, ExternalLink } from "lucide-react";
import { useSelectedSystemSlug } from "@/app/system/system.state";

export function DataStoreOverview() {
  const systemSlug = useSelectedSystemSlug();

  const { data: dataStores, isLoading } = useSystemDataStores(systemSlug!);

  if (!systemSlug) {
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
                <BreadcrumbPage>Data Stores</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="mb-2 text-3xl font-bold tracking-tight">Data Stores</h2>
            <p className="text-muted-foreground text-lg">Manage your data store connections</p>
          </div>
          <Button asChild>
            <Link to={`/systems/${systemSlug}/data-stores/new`} className="gap-2">
              <PlusCircle className="size-4" />
              Create Data Store
            </Link>
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Connection</TableHead>
                <TableHead>Database</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataStores?.map((dataStore) => (
                <TableRow key={dataStore.slug}>
                  <TableCell>{dataStore.slug}</TableCell>
                  <TableCell>{dataStore.connectionConfig.database}</TableCell>
                  <TableCell>{dataStore.connectionConfig.host}</TableCell>
                  <TableCell className="capitalize">{dataStore.connectionConfig.type}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/systems/${systemSlug}/data-stores/${dataStore.slug}`}>
                          <ExternalLink className="size-4" />
                          <span className="sr-only">View Details</span>
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/systems/${systemSlug}/data-stores/${dataStore.slug}/tables`}>
                          <Database className="size-4" />
                          <span className="sr-only">Show Database Diagram</span>
                        </Link>
                      </Button>
                    </div>
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
