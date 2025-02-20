import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { OnboardingSteps, type OnboardingStepId } from "./onboarding-steps";
import { useSystems } from "@/data/system/system.data";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardHome() {
  const organizationCode = useSelectedOrganizationCode();

  if (!organizationCode) {
    return <div>No organization selected</div>;
  }

  const completedSteps: OnboardingStepId[] = [];

  const { data: systems, isLoading } = useSystems(organizationCode);

  if (systems?.length) {
    completedSteps.push("create-system");
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
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
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <div className="max-w-2xl">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Welcome to ReJot</h1>
          <p className="text-muted-foreground text-lg">
            Synchronization engine to enable reactive backends for cross-team integrations
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <OnboardingSteps className="mb-4" completedSteps={completedSteps} />
        )}
      </div>
    </>
  );
}
