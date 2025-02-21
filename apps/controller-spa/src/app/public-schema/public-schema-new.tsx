import { useNavigate, useParams, useSearchParams } from "react-router";
import { useSelectedSystemSlug } from "../system/system.state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/progress-bar";
import { Database, Code2, BookMarked, Code } from "lucide-react";
import { SelectDataStoreStep } from "./steps/select-data-store-step";
import { CreateTransformationStep } from "./steps/create-transformation-step";
import { PublicSchemaSearchParamsSchema } from "./public-schema-step.types";
import { PublicSchemaStepSchema } from "./public-schema-step.types";
import { TransformationTypeStep } from "./steps/transformation-type-step";
import { SelectBaseTableStep } from "./steps/select-base-table-step";
import { PublicSchemaNewHeader } from "./public-schema-new-header";

const STEPS = {
  "select-data-store": 0,
  "select-transformation-type": 1,
  "select-base-table": 2,
  "create-transformation": 3,
} as const;

export function PublicSchemaNew() {
  const navigate = useNavigate();
  const { step } = useParams();
  const [searchParams] = useSearchParams();
  const systemSlug = useSelectedSystemSlug();

  if (!systemSlug) {
    return null;
  }

  // Validate step parameter
  const validatedStep = PublicSchemaStepSchema.safeParse(step);
  const currentStep = validatedStep.success ? STEPS[validatedStep.data] : 0;

  // Validate search parameters based on current step
  const searchParamsObj = Object.fromEntries(searchParams.entries());
  const validatedParams = PublicSchemaSearchParamsSchema.safeParse({
    step: validatedStep.success ? validatedStep.data : "select-data-store",
    ...searchParamsObj,
  });

  // If parameters are invalid, redirect to the first step
  if (!validatedParams.success && currentStep !== 0) {
    navigate("/public-schemas/new/select-data-store");
    return null;
  }

  const steps = [
    {
      label: "Select Data Store",
      children: <Database className="size-5" />,
      description: "Choose data store",
    },
    {
      label: "Transformation Type",
      children: <Code className="size-5" />,
      description: "Choose transformation type",
    },
    {
      label: "Base Table",
      children: <BookMarked className="size-5" />,
      description: "Select base table",
    },
    {
      label: "Create Transformation",
      children: <Code2 className="size-5" />,
      description: "Define transformation",
    },
  ];

  const handleBack = () => {
    if (currentStep === 3 && validatedParams.success) {
      const data = validatedParams.data;
      if (data.step === "create-transformation") {
        const params = new URLSearchParams();
        params.set("dataStoreSlug", data.dataStoreSlug);
        params.set("transformationType", data.transformationType);
        params.set("baseTable", data.baseTable);
        navigate(`/public-schemas/new/select-base-table?${params.toString()}`);
      }
    } else if (currentStep === 2 && validatedParams.success) {
      const data = validatedParams.data;
      if (data.step === "select-base-table") {
        const params = new URLSearchParams();
        params.set("dataStoreSlug", data.dataStoreSlug);
        params.set("transformationType", data.transformationType);
        navigate(`/public-schemas/new/select-transformation-type?${params.toString()}`);
      }
    } else if (currentStep === 1 && validatedParams.success) {
      const data = validatedParams.data;
      if (data.step === "select-transformation-type") {
        const params = new URLSearchParams();
        params.set("dataStoreSlug", data.dataStoreSlug);
        navigate(`/public-schemas/new/select-data-store?${params.toString()}`);
      }
    } else {
      navigate("/public-schemas/new/select-data-store");
    }
  };

  const renderContent = () => {
    if (!validatedParams.success) {
      return null;
    }

    const data = validatedParams.data;

    switch (data.step) {
      case "select-data-store":
        return (
          <SelectDataStoreStep
            systemSlug={systemSlug}
            onSelected={(dataStoreSlug) => {
              const params = new URLSearchParams();
              params.set("dataStoreSlug", dataStoreSlug);
              navigate(`/public-schemas/new/select-transformation-type?${params.toString()}`);
            }}
          />
        );
      case "select-transformation-type":
        return (
          <TransformationTypeStep
            onBack={handleBack}
            onSelected={(type) => {
              const params = new URLSearchParams();
              params.set("dataStoreSlug", data.dataStoreSlug);
              params.set("transformationType", type);
              navigate(`/public-schemas/new/select-base-table?${params.toString()}`);
            }}
          />
        );
      case "select-base-table":
        return (
          <SelectBaseTableStep
            systemSlug={systemSlug}
            dataStoreSlug={data.dataStoreSlug}
            onBack={handleBack}
            onSelected={(table) => {
              const params = new URLSearchParams();
              params.set("dataStoreSlug", data.dataStoreSlug);
              params.set("transformationType", data.transformationType);
              params.set("baseTable", table);
              navigate(`/public-schemas/new/create-transformation?${params.toString()}`);
            }}
          />
        );
      case "create-transformation":
        return (
          <CreateTransformationStep
            systemSlug={systemSlug}
            dataStoreSlug={data.dataStoreSlug}
            baseTable={data.baseTable}
            onBack={handleBack}
            onSuccess={(publicSchemaId) => {
              navigate(`/public-schemas/${publicSchemaId}`);
            }}
          />
        );
    }
  };

  return (
    <>
      <PublicSchemaNewHeader />
      <div className="space-y-6">
        <ProgressBar steps={steps} currentStep={currentStep} />
        <div className="flex justify-center">
          <Card className="mx-6 w-full max-w-5xl">
            <CardHeader className="space-y-1">
              <CardTitle>
                {currentStep === 0 && "Select Data Store"}
                {currentStep === 1 && "Choose Transformation Type"}
                {currentStep === 2 && "Select Base Table"}
                {currentStep === 3 && "Create Transformation"}
              </CardTitle>
              <CardDescription>
                {currentStep === 0 && "Choose the data store to create a public schema from"}
                {currentStep === 1 && "Select how you want to transform your data"}
                {currentStep === 2 && "Choose the base table for your transformation"}
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
