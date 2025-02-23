import { NavLink, useParams } from "react-router";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useConsumerSchema } from "@/data/consumer-schema/consumer-schema.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { useSelectedSystemSlug } from "../system/system.state";
import { SqlCodeMirror } from "../public-schema/components/sql-code-mirror";

export function ConsumerSchemaDetail() {
  const { consumerSchemaId } = useParams();
  const organizationId = useSelectedOrganizationCode();
  const systemSlug = useSelectedSystemSlug();

  if (!systemSlug || !consumerSchemaId || !organizationId) {
    return null;
  }

  const { data: consumerSchema, isLoading } = useConsumerSchema(systemSlug, consumerSchemaId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (!consumerSchema) {
    return <div>Consumer schema not found</div>;
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
                <BreadcrumbLink asChild>
                  <NavLink to="/consumer-schemas">Consumer Schemas</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{consumerSchema.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <div className="mb-2 flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">{consumerSchema.name}</h1>
            <Badge variant={consumerSchema.status === "active" ? "default" : "secondary"}>
              {consumerSchema.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-lg">
            Consumer schema details and transformations
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connection Details</CardTitle>
            <CardDescription>Data store connection information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Data Store:</span>
                <span>{consumerSchema.connection.slug}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transformations</CardTitle>
            <CardDescription>Active transformations and their SQL</CardDescription>
          </CardHeader>
          <CardContent>
            {consumerSchema.transformations.map((transformation, index) => (
              <div key={index} className="mb-6 last:mb-0">
                <div className="mb-4">
                  <h3 className="text-lg font-medium">Version {transformation.majorVersion}</h3>
                </div>

                <div className="mt-4">
                  <h4 className="mb-2 text-sm font-medium">SQL Transformation</h4>
                  <SqlCodeMirror
                    className="h-[340px]"
                    value={transformation.details.sql}
                    editable={false}
                    baseTable=""
                    tableColumns={[]}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
