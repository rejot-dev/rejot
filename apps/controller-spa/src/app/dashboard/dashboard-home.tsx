import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSystems } from "@/data/system/system.data";
import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { setSelectedSystemSlug } from "../system/system.state";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";

export function DashboardHome() {
  const organizationCode = useSelectedOrganizationCode();

  if (!organizationCode) {
    return <div>No organization selected</div>;
  }

  const { data: systems, isLoading } = useSystems(organizationCode);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Home</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-col gap-6 p-6">
        <div className="max-w-2xl">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Welcome to ReJot</h1>
          <p className="text-muted-foreground text-lg">
            Synchronization engine to enable reactive backends for cross-team integrations
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="bg-card rounded-lg border p-4">
            <h3 className="mb-2 font-semibold">Quick Start Guide</h3>
            <p className="text-muted-foreground text-sm">
              Learn the basics of ReJot and get up to speed with our core features.
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl border">
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Systems</h2>
              <Button asChild>
                <Link to="/systems/new" className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Onboard New System
                </Link>
              </Button>
            </div>
            {isLoading ? (
              <div>Loading systems...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Slug</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {systems?.map((system) => (
                    <TableRow key={system.code}>
                      <TableCell>
                        <Link
                          onClick={() => setSelectedSystemSlug(system.slug)}
                          to={`/systems/${system.slug}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {system.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono">{system.code}</TableCell>
                      <TableCell>{system.slug}</TableCell>
                    </TableRow>
                  ))}
                  {!systems?.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground text-center">
                        No systems found. Get started by onboarding your first system.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
