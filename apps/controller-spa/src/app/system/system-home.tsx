import { ArchitectureDiagram } from "@/app/system/architecture/system-architecture-diagram";
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
import { useRecentSchemaChanges, useSystemOverview } from "@/data/system/system.data";
import { NavLink, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

export function SystemHome() {
  const { systemSlug } = useParams();
  const organizationId = useSelectedOrganizationCode();

  if (!systemSlug) {
    return <div>404: System not found</div>;
  }

  const { data, isLoading, isError, error } = useSystemOverview(systemSlug);
  const [selectedTable, setSelectedTable] = useState<string>();
  const [selectedSchema, selectedTableName] = selectedTable?.split(".") ?? ["", ""];

  const connectionSlug = data?.dataStores.find((ds) =>
    ds.publication.tables?.includes(selectedTableName ?? ""),
  )?.slug;

  const { data: schemaChanges, isLoading: isLoadingChanges } = useRecentSchemaChanges(
    organizationId ?? "",
    connectionSlug ?? "",
    selectedSchema ?? "",
    selectedTableName ?? "",
  );

  if (isError) {
    return <div>Error: {error.message}</div>;
  }

  const system = data;

  if (isLoading || !system) {
    return <div>Loading...</div>;
  }

  console.log({
    system,
  });

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
                <BreadcrumbPage>{system.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">System Overview</h1>
            <p className="text-lg text-muted-foreground">
              View system details and configuration for &apos;{system.name}&apos;.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4">
        <div className="h-full w-full">
          {
            <ArchitectureDiagram
              systemOverview={system}
              className="w-full h-full shadow-md"
              disableSimulation={false}
            />
          }
        </div>
      </div>

      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="mb-2 text-3xl font-bold tracking-tight">Data Stores</h3>
          </div>
          <Button asChild>
            <NavLink to={`/systems/${systemSlug}/data-stores/new`}>Add Data Store</NavLink>
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="w-[300px]">
            <Select value={selectedTable} onValueChange={(value) => setSelectedTable(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {system.dataStores.map((ds) =>
                  (ds.publication.tables || []).map((table) => (
                    <SelectItem key={`public.${table}`} value={`public.${table}`}>
                      {`public.${table}`}
                    </SelectItem>
                  )),
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schema</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingChanges ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      Loading schema changes...
                    </TableCell>
                  </TableRow>
                ) : !schemaChanges?.changes?.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      No recent schema changes
                    </TableCell>
                  </TableRow>
                ) : (
                  schemaChanges.changes.map((change, index) => (
                    <TableRow key={index}>
                      <TableCell>{selectedSchema}</TableCell>
                      <TableCell>{selectedTableName}</TableCell>
                      <TableCell>{change.details}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}
