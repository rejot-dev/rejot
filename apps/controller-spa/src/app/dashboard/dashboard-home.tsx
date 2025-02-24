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
import { useSystemOverview } from "@/data/system/system.data";
import { Link } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SpanSystem, SpanPublicSchema, SpanConsumerSchema } from "@/components/architecture-spans";

export function DashboardHome() {
  const organizationCode = useSelectedOrganizationCode();
  const systemSlug = useSelectedSystemSlug();

  if (!organizationCode) {
    return <div>No organization selected</div>;
  }

  const connections = useConnections(organizationCode);
  const systemOverview = useSystemOverview(systemSlug, { retry: false });

  // Compute completed steps based on current state
  const completedSteps: OnboardingStepId[] = [];
  if (systemSlug) {
    completedSteps.push("create-system");
  }

  if (connections.data && connections.data.length > 0) {
    completedSteps.push("create-connection");
  }

  if (systemOverview.data && systemOverview.data.dataStores.length > 0) {
    completedSteps.push("create-data-store");
  }

  if (systemOverview.error) {
    // Clear the array, since we should create a new system.
    completedSteps.splice(0, completedSteps.length);
  }

  const onboardingCompleted = completedSteps.length === 3;

  const message = onboardingCompleted ? (
    <p className="text-muted-foreground text-lg">
      You&apos;re all set! Go check out your{" "}
      <Link className="text-primary hover:underline" to={`/systems/${systemSlug}`}>
        <SpanSystem label="System Overview" />
      </Link>
      , or create some{" "}
      <Link className="text-primary hover:underline" to={`/public-schemas`}>
        <SpanPublicSchema label="Public Schemas" />
      </Link>{" "}
      and{" "}
      <Link className="text-primary hover:underline" to={`/consumer-schemas`}>
        <SpanConsumerSchema label="Consumer Schemas" />
      </Link>
      .
    </p>
  ) : (
    <div>
      <p className="text-muted-foreground text-lg">
        Thank you for signing up to the ReJot Limited Access Preview! A few small steps are required
        to get you started synchronizing data between backend services.
      </p>
    </div>
  );

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
        <div className="space-y-4">
          <h1 className="mb-2 text-3xl font-bold tracking-tight">Welcome to ReJot</h1>
          <Alert>
            <AlertTitle>Limited Access Preview</AlertTitle>
            <AlertDescription className="space-y-2 text-sm">
              <p>
                In the ReJot Limited Access Preview, you currently do{" "}
                <span className="font-bold"> not </span>
                have access to the Sync Engine. You may still use your database connection to view
                your schemas and explore ReJot. We are onboarding users slowly.
              </p>
              <p>
                If you want to get access to the full ReJot platform now, please{" "}
                <a href="mailto:founders@rejot.dev" className="text-primary underline">
                  contact us
                </a>
                .
              </p>
            </AlertDescription>
          </Alert>
          <div className="max-w-prose space-y-4">{message}</div>
        </div>
        <OnboardingSteps
          className="mb-4"
          completedSteps={completedSteps}
          connections={connections.data ?? []}
          isLoading={connections.isLoading || systemOverview.isLoading}
          systemOverview={systemOverview.data}
        />
      </div>
    </>
  );
}
