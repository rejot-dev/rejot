import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { CreateSystemStep } from "./steps/create-system-step";
import { CreateConnectionStep } from "./steps/create-connection-step";
import { CreateDataStoreStep } from "./steps/create-data-store-step";
import type { Connection } from "@/data/connection/connection.data";
import { Skeleton } from "@/components/ui/skeleton";
import type { SystemOverview } from "@/data/system/system.data";
import { useSearchParams } from "react-router";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
}

const steps = [
  {
    id: "create-system",
    title: "Create a System",
    description: "Set up your first system to start managing your integrations",
  },
  {
    id: "create-connection",
    title: "Create a Connection",
    description: "Connect to your data source to enable synchronization",
  },
  {
    id: "create-data-store",
    title: "Create a Data Store",
    description: "Configure where your synchronized data will be stored",
  },
] as const satisfies OnboardingStep[];

export type OnboardingStepId = (typeof steps)[number]["id"];

export interface OnboardingStepsProps {
  className?: string;
  completedSteps: OnboardingStepId[];
  connections: Connection[];
  systemOverview?: SystemOverview;
  isLoading: boolean;
}

export function OnboardingSteps({
  className,
  completedSteps,
  connections,
  isLoading,
  systemOverview,
}: OnboardingStepsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedStep, setSelectedStep] = useState<OnboardingStepId | null>(() => {
    if (isLoading) {
      return null;
    }

    // Try to get step from URL, otherwise find first incomplete step
    const stepFromUrl = searchParams.get("step") as OnboardingStepId | null;
    if (stepFromUrl && steps.some((step) => step.id === stepFromUrl)) {
      return stepFromUrl;
    }

    const nextIncompleteStep = steps.find((step) => !completedSteps.includes(step.id));
    return nextIncompleteStep?.id ?? null;
  });

  // Update selected step when loading completes
  useEffect(() => {
    if (!isLoading) {
      const stepFromUrl = searchParams.get("step") as OnboardingStepId | null;
      if (stepFromUrl && steps.some((step) => step.id === stepFromUrl)) {
        setSelectedStep(stepFromUrl);
      } else {
        const nextIncompleteStep = steps.find((step) => !completedSteps.includes(step.id));
        setSelectedStep(nextIncompleteStep?.id ?? null);
      }
    }
  }, [isLoading, completedSteps, searchParams]);

  const handleStepSelect = (stepId: OnboardingStepId | null) => {
    setSelectedStep(stepId);
    if (stepId) {
      searchParams.set("step", stepId);
    } else {
      searchParams.delete("step");
    }
    setSearchParams(searchParams);
  };

  const handleStepComplete = (stepId: OnboardingStepId) => {
    // Move to the next step if available
    const currentIndex = steps.findIndex((step) => step.id === stepId);
    const nextStep = steps[currentIndex + 1];
    if (nextStep) {
      handleStepSelect(nextStep.id);
    } else {
      handleStepSelect(null);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("relative space-y-6", className)}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.title} className="group cursor-wait">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    <Skeleton className="h-6 w-32" />
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-6 rounded-full" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative space-y-6", className)}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <Card
            key={step.title}
            className={cn(
              "group cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md",
              completedSteps.includes(step.id) && "border-green-500/30 bg-green-500/5",
              selectedStep === step.id &&
                !completedSteps.includes(step.id) &&
                "border-primary/30 bg-primary/5",
            )}
            onClick={() => handleStepSelect(selectedStep === step.id ? null : step.id)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <div className="flex items-center gap-2">
                  {completedSteps.includes(step.id) && (
                    <div className="rounded-full bg-green-500/10 p-1">
                      <Check className="size-4 text-green-500" />
                    </div>
                  )}
                  <ChevronRight
                    className={cn(
                      "text-muted-foreground size-4 transition-transform",
                      "group-hover:translate-x-0.5",
                      selectedStep === step.id && "rotate-90",
                    )}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedStep === "create-system" && (
        <CreateSystemStep
          completed={completedSteps.includes("create-system")}
          onComplete={() => handleStepComplete("create-system")}
        />
      )}
      {selectedStep === "create-connection" && (
        <CreateConnectionStep
          completed={completedSteps.includes("create-connection")}
          isLoading={isLoading}
          connections={connections}
        />
      )}
      {selectedStep === "create-data-store" && (
        <CreateDataStoreStep
          completed={completedSteps.includes("create-data-store")}
          isLoading={isLoading}
          systemOverview={systemOverview}
        />
      )}
    </div>
  );
}
