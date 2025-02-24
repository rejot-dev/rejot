import { useNavigate, useParams, useSearchParams } from "react-router";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionNewHeader } from "./connection-new-header";
import { ProgressBar } from "@/components/progress-bar";
import { ConfigurePostgresStep } from "./steps/configure-postgres-step";
import { ConnectionTypeStep } from "./steps/connection-type-step";
import { useToast } from "@/hooks/use-toast";
import { ConnectionSearchParamsSchema, ConnectionStepSchema } from "./connection-step.types";

const STEPS = {
  "select-type": 0,
  "configure-connection": 1,
} as const;

export function ConnectionNew() {
  const navigate = useNavigate();
  const { step } = useParams();
  const [searchParams] = useSearchParams();
  const organizationId = useSelectedOrganizationCode();
  const { toast } = useToast();

  // Validate step parameter
  const validatedStep = ConnectionStepSchema.safeParse(step);
  const currentStep = validatedStep.success ? STEPS[validatedStep.data] : 0;

  // Validate search parameters based on current step
  const searchParamsObj = Object.fromEntries(searchParams.entries());
  const validatedParams = ConnectionSearchParamsSchema.safeParse({
    step: validatedStep.success ? validatedStep.data : "select-type",
    ...searchParamsObj,
  });

  if (!organizationId) {
    return null;
  }

  // If parameters are invalid, redirect to the first step
  if (!validatedParams.success && currentStep !== 0) {
    navigate("/connections/new/select-type");
    return null;
  }

  const steps = [
    {
      label: "Select Type",
      children: <Database className="size-5" />,
      description: "Choose connection type",
    },
    {
      label: "Configure Connection",
      children: <Database className="size-5" />,
      description: "Configure and verify connection",
    },
  ];

  const handleBack = () => {
    navigate("/connections/new/select-type");
  };

  return (
    <>
      <ConnectionNewHeader />
      <div className="space-y-6">
        <ProgressBar steps={steps} currentStep={currentStep} />
        <div className="flex justify-center">
          <Card className="mx-6 w-full max-w-5xl">
            <CardHeader className="space-y-1">
              <CardTitle>
                {currentStep === 0 && "Select Connection Type"}
                {currentStep === 1 && "Configure Connection"}
              </CardTitle>
              <CardDescription>
                {currentStep === 0 && "Choose the type of database you want to connect"}
                {currentStep === 1 &&
                  "Configure your database connection settings and verify the connection"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentStep === 0 && <ConnectionTypeStep />}
              {currentStep === 1 &&
                validatedParams.success &&
                validatedParams.data.step === "configure-connection" && (
                  <ConfigurePostgresStep
                    onBack={handleBack}
                    onConfigured={(_config) => {
                      toast({
                        title: "Connection created successfully",
                        description: "Your new database connection has been set up.",
                      });
                      navigate("/connections");
                    }}
                  />
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
