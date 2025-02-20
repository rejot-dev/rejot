import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { CreateSystemStep } from "./steps/create-system-step";
import { CreateConnectionStep } from "./steps/create-connection-step";
import { CreateDataStoreStep } from "./steps/create-data-store-step";

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
  completedSteps?: OnboardingStepId[];
}

export function OnboardingSteps({ className, completedSteps = [] }: OnboardingStepsProps) {
  const [selectedStep, setSelectedStep] = useState<OnboardingStepId | null>(steps[0].id);
  const [localCompletedSteps, setLocalCompletedSteps] =
    useState<OnboardingStepId[]>(completedSteps);

  const handleStepComplete = (stepId: OnboardingStepId) => {
    setLocalCompletedSteps((prev) => [...prev, stepId]);
    // Move to the next step if available
    const currentIndex = steps.findIndex((step) => step.id === stepId);
    const nextStep = steps[currentIndex + 1];
    if (nextStep) {
      setSelectedStep(nextStep.id);
    }
  };

  return (
    <div className={cn("relative space-y-6", className)}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <Card
            key={step.title}
            className={cn(
              "group cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md",
              localCompletedSteps.includes(step.id) && "border-green-500/30 bg-green-500/5",
              selectedStep === step.id &&
                !localCompletedSteps.includes(step.id) &&
                "border-primary/30 bg-primary/5",
            )}
            onClick={() => setSelectedStep(selectedStep === step.id ? null : step.id)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <div className="flex items-center gap-2">
                  {localCompletedSteps.includes(step.id) && (
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
          completed={localCompletedSteps.includes("create-system")}
          onComplete={() => handleStepComplete("create-system")}
        />
      )}
      {selectedStep === "create-connection" && (
        <CreateConnectionStep completed={localCompletedSteps.includes("create-connection")} />
      )}
      {selectedStep === "create-data-store" && (
        <CreateDataStoreStep completed={localCompletedSteps.includes("create-data-store")} />
      )}
    </div>
  );
}
