import { useNavigate, useParams, useSearchParams } from "react-router";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionNewHeader } from "./connection-new-header";
import { ProgressBar } from "@/components/progress-bar";
import { ConfigurePostgresStep } from "./steps/configure-postgres-step";

const STEPS = {
  "select-type": 0,
  "configure-connection": 1,
} as const;

type StepKey = keyof typeof STEPS;

export function ConnectionNew() {
  const navigate = useNavigate();
  const { step } = useParams();
  const [searchParams] = useSearchParams();
  const organizationId = useSelectedOrganizationCode();
  const currentStep = STEPS[step as StepKey] ?? 0;
  const connectionType = searchParams.get("type");

  if (!organizationId) {
    return null;
  }

  const steps = [
    {
      label: "Select Type",
      children: <Database className="size-5" />,
      description: "Choose connection type",
    },
    {
      label: "Configure",
      children: <Database className="size-5" />,
      description: "Configure connection",
    },
  ];

  const handleBack = () => {
    navigate("/connections/new/select-type");
  };

  return (
    <>
      <ConnectionNewHeader step={step} />
      <div className="container space-y-6">
        <ProgressBar steps={steps} currentStep={currentStep} />
        <Card className="mx-auto max-w-2xl">
          <CardHeader className="space-y-1">
            <CardTitle>
              {currentStep === 0 && "Select Connection Type"}
              {currentStep === 1 && "Configure Connection"}
            </CardTitle>
            <CardDescription>
              {currentStep === 0 && "Choose the type of database you want to connect"}
              {currentStep === 1 && "Configure your database connection settings"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card
                  className="hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => navigate("/connections/new/configure-connection?type=postgres")}
                >
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Database className="size-5" />
                      <CardTitle>PostgreSQL</CardTitle>
                    </div>
                    <CardDescription>Connect to a PostgreSQL database to sync data</CardDescription>
                  </CardHeader>
                </Card>
              </div>
            )}
            {currentStep === 1 && connectionType === "postgres" && (
              <ConfigurePostgresStep onBack={handleBack} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
