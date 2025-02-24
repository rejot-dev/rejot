import { NavLink } from "react-router";
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
import { useSelectedSystemSlug } from "@/app/system/system.state";
import { DataStoreList } from "./data-store-list";
import { useSystemOverview } from "@/data/system/system.data";

export function DataStoreOverview() {
  const systemSlug = useSelectedSystemSlug();

  const { data: systemOverview, isLoading } = useSystemOverview(systemSlug);

  if (!systemSlug) {
    return null;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!systemOverview) {
    return null;
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
        <DataStoreList systemSlug={systemSlug} />
      </div>
    </>
  );
}
