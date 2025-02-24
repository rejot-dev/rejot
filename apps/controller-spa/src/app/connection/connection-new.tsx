import { useNavigate, useParams, useSearchParams, useLocation } from "react-router";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionNewHeader } from "./connection-new-header";
import { ProgressBar } from "@/components/progress-bar";
import { ConfigurePostgresStep } from "./steps/configure-postgres-step";
import { ConnectionTypeStep } from "./steps/connection-type-step";
import { PostgresReadonlyUserInstruction } from "./steps/postgres-readonly-user-instruction";
import type { Connection } from "@/data/connection/connection.data";
import { z } from "zod";

const STEPS = {
  "select-type": 0,
  "readonly-user": 1,
  "configure-connection": 2,
} as const;

const ExtendedStepSchema = z.enum(["select-type", "readonly-user", "configure-connection"]);

const ExtendedSearchParamsSchema = z.object({
  step: ExtendedStepSchema,
  type: z.enum(["postgres"]).optional(),
});

export function ConnectionNew() {
  const navigate = useNavigate();
  const location = useLocation();
  const { step } = useParams();
  const [searchParams] = useSearchParams();
  const organizationId = useSelectedOrganizationCode();

  // Validate step parameter
  const validatedStep = ExtendedStepSchema.safeParse(step);
  const currentStep = validatedStep.success ? STEPS[validatedStep.data] : 0;

  // Validate search parameters based on current step
  const searchParamsObj = Object.fromEntries(searchParams.entries());
  const validatedParams = ExtendedSearchParamsSchema.safeParse({
    step: validatedStep.success ? validatedStep.data : "select-type",
    ...searchParamsObj,
  });

  // Get the connection from location state
  const connectionState = location.state as { connection: Connection } | undefined;

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
      label: "Setup Readonly User",
      children: <Database className="size-5" />,
      description: "Configure readonly database access",
    },
    {
      label: "Configure Connection",
      children: <Database className="size-5" />,
      description: "Configure and verify connection",
    },
  ];

  const handleBack = () => {
    if (currentStep === STEPS["configure-connection"]) {
      navigate("/connections/new/readonly-user");
      return;
    }
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
                {currentStep === STEPS["select-type"] && "Select Connection Type"}
                {currentStep === STEPS["readonly-user"] && "Setup Readonly User"}
                {currentStep === STEPS["configure-connection"] && "Configure Connection"}
              </CardTitle>
              <CardDescription>
                {currentStep === STEPS["select-type"] &&
                  "Choose the type of database you want to connect"}
                {currentStep === STEPS["readonly-user"] &&
                  "Follow these steps to create a readonly user for your database"}
                {currentStep === STEPS["configure-connection"] &&
                  "Configure your database connection settings and verify the connection"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentStep === STEPS["select-type"] && <ConnectionTypeStep />}
              {currentStep === STEPS["readonly-user"] &&
                validatedParams.success &&
                validatedParams.data.step === "readonly-user" && (
                  <PostgresReadonlyUserInstruction
                    onNext={() => {
                      navigate("/connections/new/configure-connection", {
                        state: { connection: connectionState?.connection },
                      });
                    }}
                  />
                )}
              {currentStep === STEPS["configure-connection"] &&
                validatedParams.success &&
                validatedParams.data.step === "configure-connection" && (
                  <ConfigurePostgresStep
                    onBack={handleBack}
                    onConfigured={(_config) => {
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
