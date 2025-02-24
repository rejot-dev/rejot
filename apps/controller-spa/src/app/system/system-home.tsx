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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { useState } from "react";
import {
  SpanConsumerSchema,
  SpanDataStore,
  SpanPublicSchema,
  SpanSyncService,
  SpanSystem,
} from "@/components/architecture-spans";

export function SystemHome() {
  const { systemSlug } = useParams();
  const [isInfoOpen, setIsInfoOpen] = useState(false);

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

      <div className="px-4 py-2">
        <Collapsible open={isInfoOpen} onOpenChange={setIsInfoOpen}>
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setIsInfoOpen(!isInfoOpen)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="size-4" />
                  <CardTitle className="text-lg">About This Page</CardTitle>
                </div>
                <CollapsibleTrigger>
                  {isInfoOpen ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <CardDescription className="space-y-2 text-sm">
                  <p className="max-w-[90ch]">
                    This overview visualizes how databases are (and can be) connected within your
                    organization.
                  </p>
                  <ul className="max-w-[90ch] list-disc pl-6">
                    <li>
                      A <SpanSystem /> represents a collection of sync services and databases,
                      typically a system is created for production/staging/development environments.
                    </li>
                    <li>
                      The <SpanDataStore /> is a database owned by a team, based on a connection.
                    </li>
                    <li>
                      The <SpanSyncService /> is deployed in your infrastructure and listens for
                      changes in the source databases associated with it. An organization can have
                      multiple Sync Services active, scoping the data contained within it.
                    </li>
                    <li>
                      When you create a <SpanPublicSchema />, it&apos;ll be shown as child node of
                      the table containing the source of truth. Public Schemas are defined by the
                      owners of the Data Store to make the data available to other teams.
                    </li>
                    <li>
                      A <SpanConsumerSchema /> is based on a Public Schema and written to a Data
                      Store. These are created by teams that want to integrate data from other
                      teams.
                    </li>
                  </ul>
                </CardDescription>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
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
    </>
  );
}
