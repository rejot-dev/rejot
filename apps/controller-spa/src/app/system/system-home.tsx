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
import { useSystemOverview } from "@/data/system/system.data";
import { NavLink, useParams } from "react-router";
import { Button } from "@/components/ui/button";

export function SystemHome() {
  const { systemSlug } = useParams();

  if (!systemSlug) {
    return <div>404: System not found</div>;
  }

  const { data, isLoading, isError, error } = useSystemOverview(systemSlug);

  if (isError) {
    return <div>Error: {error.message}</div>;
  }

  const system = data;

  if (isLoading || !system) {
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
            <p className="text-muted-foreground text-lg">
              View system details and configuration for &apos;{system.name}&apos;.
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4">
        <div className="size-full">
          {
            <ArchitectureDiagram
              systemOverview={system}
              className="size-full shadow-md"
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
      </div>
    </>
  );
}
