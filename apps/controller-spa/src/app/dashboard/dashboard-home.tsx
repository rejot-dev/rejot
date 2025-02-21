import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { useConnections } from "@/data/connection/connection.data";
import { useSelectedSystemSlug } from "@/app/system/system.state";
import { OnboardingSteps } from "./onboarding-steps";
import type { OnboardingStepId } from "./onboarding-steps";

export function DashboardHome() {
  const organizationCode = useSelectedOrganizationCode();
  const systemSlug = useSelectedSystemSlug();

  if (!organizationCode) {
    return <div>No organization selected</div>;
  }

  const connections = useConnections(organizationCode);

  // Compute completed steps based on current state
  const completedSteps: OnboardingStepId[] = [];
  if (systemSlug) {
    completedSteps.push("create-system");
  }

  if (connections.data && connections.data.length > 0) {
    completedSteps.push("create-connection");
  }

  if (!organizationCode) {
    return <div>No organization selected</div>;
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
            A few small steps are required to get you started synchronizing data between backend
            services.
          </p>
        </div>
        <OnboardingSteps
          className="mb-4"
          completedSteps={completedSteps}
          connections={connections.data ?? []}
          isLoading={connections.isLoading}
        />
      </div>
    </>
  );
}
