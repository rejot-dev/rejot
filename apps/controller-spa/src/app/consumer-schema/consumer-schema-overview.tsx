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
import { useConsumerSchemas } from "@/data/consumer-schema/consumer-schema.data";
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
import { useSelectedSystemSlug } from "../system/system.state";

export function ConsumerSchemaOverview() {
  const systemSlug = useSelectedSystemSlug();

  const { data: consumerSchemas, isLoading } = useConsumerSchemas(systemSlug);

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
                <BreadcrumbPage>Consumer Schemas</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="mb-2 text-3xl font-bold tracking-tight">Consumer Schemas</h2>
            <p className="text-muted-foreground text-lg">Manage your consumer database schemas</p>
          </div>
          <Button asChild>
            <Link to="new" className="gap-2">
              <PlusCircle className="size-4" />
              Create Schema
            </Link>
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Store</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumerSchemas?.map((schema) => (
                <TableRow key={schema.id}>
                  <TableCell>{schema.name}</TableCell>
                  <TableCell>{schema.status}</TableCell>
                  <TableCell>{schema.connection.slug}</TableCell>
                  <TableCell>
                    <Link to={`/consumer-schemas/${schema.id}`}>More Info</Link>
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
