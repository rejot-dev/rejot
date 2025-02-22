import { useNavigate, useParams, useSearchParams } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/progress-bar";
import { Database, Code2, BookMarked, Code } from "lucide-react";
import { SelectDataStoreStep } from "./steps/select-data-store-step";
import { SelectPublicSchemaStep } from "./steps/select-public-schema-step";
import { TransformationTypeStep } from "./steps/transformation-type-step";
import { CreateTransformationStep } from "./steps/create-transformation-step";
import { ConsumerSchemaNewHeader } from "./consumer-schema-new-header";
import { useSelectedSystemSlug } from "../system/system.state";

const STEPS = {
  "select-data-store": 0,
  "select-public-schema": 1,
  "select-transformation-type": 2,
  "create-transformation": 3,
} as const;

type StepKey = keyof typeof STEPS;

export function ConsumerSchemaNew() {
  const navigate = useNavigate();
  const { step } = useParams();
  const [searchParams] = useSearchParams();

  const systemSlug = useSelectedSystemSlug();

  if (!systemSlug) {
    return null;
  }

  // Validate step parameter
  const validatedStep = step as StepKey | undefined;
  const currentStep = validatedStep ? STEPS[validatedStep] : 0;

  const steps = [
    {
      label: "Select Data Store",
      children: <Database className="size-5" />,
      description: "Choose data store",
    },
    {
      label: "Select Public Schema",
      children: <BookMarked className="size-5" />,
      description: "Choose public schema",
    },
    {
      label: "Transformation Type",
      children: <Code className="size-5" />,
      description: "Choose transformation type",
    },
    {
      label: "Create Transformation",
      children: <Code2 className="size-5" />,
      description: "Define transformation",
    },
  ];

  const handleBack = () => {
    if (currentStep === 3) {
      const params = new URLSearchParams(searchParams);
      navigate(`/consumer-schemas/new/select-transformation-type?${params.toString()}`);
    } else if (currentStep === 2) {
      const params = new URLSearchParams(searchParams);
      navigate(`/consumer-schemas/new/select-public-schema?${params.toString()}`);
    } else if (currentStep === 1) {
      const params = new URLSearchParams(searchParams);
      navigate(`/consumer-schemas/new/select-data-store?${params.toString()}`);
    } else {
      navigate("/consumer-schemas");
    }
  };

  const renderContent = () => {
    switch (validatedStep) {
      case "select-data-store":
        return (
          <SelectDataStoreStep
            onSelected={(dataStoreSlug: string) => {
              const params = new URLSearchParams();
              params.set("dataStoreSlug", dataStoreSlug);
              navigate(`/consumer-schemas/new/select-public-schema?${params.toString()}`);
            }}
          />
        );
      case "select-public-schema":
        return (
          <SelectPublicSchemaStep
            systemSlug={systemSlug}
            dataStoreSlug={searchParams.get("dataStoreSlug") ?? ""}
            onBack={handleBack}
            onSelected={(publicSchemaId: string) => {
              const params = new URLSearchParams(searchParams);
              params.set("publicSchemaId", publicSchemaId);
              navigate(`/consumer-schemas/new/select-transformation-type?${params.toString()}`);
            }}
          />
        );
      case "select-transformation-type":
        return (
          <TransformationTypeStep
            onBack={handleBack}
            onSelected={(type: string) => {
              const params = new URLSearchParams(searchParams);
              params.set("transformationType", type);
              navigate(`/consumer-schemas/new/create-transformation?${params.toString()}`);
            }}
          />
        );
      case "create-transformation":
        return (
          <CreateTransformationStep
            systemSlug={systemSlug}
            dataStoreSlug={searchParams.get("dataStoreSlug") ?? ""}
            publicSchemaId={searchParams.get("publicSchemaId") ?? ""}
            onBack={handleBack}
            onSuccess={(_consumerSchemaId: string) => {
              navigate(`/consumer-schemas`);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <ConsumerSchemaNewHeader />
      <div className="space-y-6">
        <ProgressBar steps={steps} currentStep={currentStep} />
        <div className="flex justify-center">
          <Card className="mx-6 w-full max-w-5xl">
            <CardHeader className="space-y-1">
              <CardTitle>
                {currentStep === 0 && "Select Data Store"}
                {currentStep === 1 && "Select Public Schema"}
                {currentStep === 2 && "Choose Transformation Type"}
                {currentStep === 3 && "Create Transformation"}
              </CardTitle>
              <CardDescription>
                {currentStep === 0 && "Choose the data store to create a consumer schema from"}
                {currentStep === 1 && "Select the public schema to consume"}
                {currentStep === 2 && "Select how you want to transform your data"}
                {currentStep === 3 && "Define your transformation"}
              </CardDescription>
            </CardHeader>
            <CardContent>{renderContent()}</CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
