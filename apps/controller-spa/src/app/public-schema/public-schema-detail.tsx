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
import { usePublicSchema } from "@/data/public-schema/public-schema.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { useSelectedSystemSlug } from "../system/system.state";
import { SchemaConfigurationEditor } from "./components/schema-configuration-editor";
import { SqlCodeMirror } from "./components/sql-code-mirror";

export function PublicSchemaDetail() {
  const { publicSchemaId } = useParams();
  const organizationId = useSelectedOrganizationCode();

  const systemSlug = useSelectedSystemSlug();

  if (!systemSlug || !publicSchemaId || !organizationId) {
    return null;
  }

  const { data: publicSchema, isLoading } = usePublicSchema(systemSlug, publicSchemaId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (!publicSchema) {
    return <div>Public schema not found</div>;
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
                  <NavLink to="/public-schemas">Public Schemas</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{publicSchema.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <div className="mb-2 flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">{publicSchema.name}</h1>
            <Badge variant={publicSchema.status === "active" ? "default" : "secondary"}>
              {publicSchema.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-lg">Public schema details and transformations</p>
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
                <span>{publicSchema.connection.slug}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transformations</CardTitle>
            <CardDescription>Active transformations and their schemas</CardDescription>
          </CardHeader>
          <CardContent>
            {publicSchema.transformations.map((transformation, index) => (
              <div key={index} className="mb-6 last:mb-0">
                <div className="mb-4">
                  <h3 className="text-lg font-medium">Version {transformation.majorVersion}</h3>
                  <p className="text-muted-foreground text-sm">
                    Base table: {transformation.baseTable}
                  </p>
                </div>

                <SchemaConfigurationEditor
                  schema={transformation.schema.map((col) => ({
                    ...col,
                    id: col.columnName,
                  }))}
                  onChange={() => {}}
                  editable={false}
                />

                <div className="mt-4">
                  <h4 className="mb-2 text-sm font-medium">SQL Transformation</h4>
                  <SqlCodeMirror
                    className="h-[340px]"
                    value={transformation.details.sql}
                    baseTable={transformation.baseTable}
                    tableColumns={transformation.schema}
                    editable={false}
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
