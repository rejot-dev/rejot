import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { useConnections } from "@/data/connection/connection.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { useAddDataStoreMutation, useSystemOverview } from "@/data/system/system.data";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { dataStoreFormSchema, type DataStoreFormValues } from "./data-store.types";
import { ProgressBar } from "@/components/progress-bar";
import { BookCopy, BookMarked, DatabaseIcon } from "lucide-react";
import { useEffect } from "react";
import { DataStoreNewHeader } from "./data-store-new-header";
import { SelectConnectionStep } from "./steps/select-connection-step";
import { ConnectionOverviewStep } from "./steps/connection-overview-step";
import { SelectPublicationStep } from "./steps/select-publication-step";
import { useQueryClient } from "@tanstack/react-query";

const STEPS = {
  "select-connection": 0,
  "connection-overview": 1,
  "select-publication": 2,
} as const;

type StepKey = keyof typeof STEPS;

export function DataStoreNew() {
  const { systemSlug, step } = useParams();
  const organizationId = useSelectedOrganizationCode();
  const addDataStoreMutation = useAddDataStoreMutation();
  const queryClient = useQueryClient();

  if (!organizationId || !systemSlug) {
    throw new Error("Organization or system slug not found");
  }

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: connections = [] } = useConnections(organizationId);
  const { data: system } = useSystemOverview(systemSlug);

  const currentStep = STEPS[step as StepKey] ?? 0;

  // If we don't have a connection slug, navigate to the first step.
  useEffect(() => {
    if (!searchParams.get("connectionSlug") && currentStep > STEPS["select-connection"]) {
      navigate({
        pathname: `/systems/${systemSlug}/data-stores/new/select-connection`,
        search: searchParams.toString(),
      });
    }
  }, []);

  const form = useForm<DataStoreFormValues>({
    resolver: zodResolver(dataStoreFormSchema),
    defaultValues: {
      connectionSlug: searchParams.get("connectionSlug") ?? undefined,
      publicationName: searchParams.get("publicationName") ?? undefined,
    },
  });

  // Update URL when form values change
  useEffect(() => {
    const subscription = form.watch((value) => {
      const params = new URLSearchParams(searchParams);
      if (value.connectionSlug) {
        params.set("connectionSlug", value.connectionSlug);
      }
      if (value.publicationName) {
        params.set("publicationName", value.publicationName);
      }
      setSearchParams(params);
    });
    return () => subscription.unsubscribe();
  }, [form, searchParams, setSearchParams]);

  const selectedConnection = connections.find((conn) => conn.slug === form.watch("connectionSlug"));

  const steps = [
    {
      label: "Select Connection",
      children: <DatabaseIcon className="size-5" />,
      description: "Choose a connection",
    },
    {
      label: "Create a Publication",
      children: <BookCopy className="size-5" />,
      description: "Manually set up a publication",
    },
    {
      label: "Select Publication",
      children: <BookMarked className="size-5" />,
      description: "Choose a publication to sync",
    },
  ];

  async function onSubmit(data: DataStoreFormValues) {
    if (!organizationId || !systemSlug) return;

    try {
      const result = await addDataStoreMutation.mutateAsync({
        organizationId,
        systemSlug,
        dataStore: {
          connectionSlug: data.connectionSlug,
          publicationName: data.publicationName,
        },
      });
      if (result.status === "error") {
        throw new Error(result.message);
      }

      // Invalidate the system overview query to refresh the data
      await queryClient.invalidateQueries({
        queryKey: ["system-overview", organizationId, systemSlug],
      });

      toast({
        title: "Success",
        description: "Data store added successfully",
      });
      // Clear search params before navigating away
      setSearchParams(new URLSearchParams());
      navigate(`/systems/${systemSlug}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add data store",
        variant: "destructive",
      });
    }
  }

  const handleConnectionSelect = () => {
    if (form.watch("connectionSlug")) {
      navigate({
        pathname: `/systems/${systemSlug}/data-stores/new/connection-overview`,
        search: searchParams.toString(),
      });
    }
  };

  const handleOverviewContinue = () => {
    navigate({
      pathname: `/systems/${systemSlug}/data-stores/new/select-publication`,
      search: searchParams.toString(),
    });
  };

  const handleBack = () => {
    const stepKeys = Object.keys(STEPS) as StepKey[];
    const currentStepKey = stepKeys.find((key) => STEPS[key] === currentStep);
    if (!currentStepKey) return;

    const previousStep = STEPS[currentStepKey] - 1;
    const previousStepKey = stepKeys.find((key) => STEPS[key] === previousStep);
    if (!previousStepKey) return;

    navigate({
      pathname: `/systems/${systemSlug}/data-stores/new/${previousStepKey}`,
      search: searchParams.toString(),
    });
  };

  if (!organizationId || !system || !systemSlug) {
    return null;
  }

  return (
    <>
      <DataStoreNewHeader systemSlug={systemSlug} />
      <div className="space-y-6">
        <ProgressBar steps={steps} currentStep={currentStep} />
        <div className="flex justify-center">
          <Card className="mx-6 w-full max-w-5xl">
            <CardHeader className="space-y-1">
              <CardTitle>
                {currentStep === 0 && "Select a Connection"}
                {currentStep === 1 && "Create a Publication"}
                {currentStep === 2 && "Choose Publication"}
              </CardTitle>
              <CardDescription>
                {currentStep === 0 && "Choose a data source to connect to your system"}
                {currentStep === 1 && "Create a publication to sync data from your data source"}
                {currentStep === 2 && "Select a publication to sync data from"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {currentStep === 0 && (
                    <SelectConnectionStep
                      form={form as UseFormReturn<Partial<DataStoreFormValues>>}
                      connections={connections}
                      onContinue={handleConnectionSelect}
                    />
                  )}

                  {currentStep === 1 && selectedConnection && (
                    <ConnectionOverviewStep
                      organizationId={organizationId}
                      connection={selectedConnection}
                      onBack={handleBack}
                      onContinue={handleOverviewContinue}
                    />
                  )}

                  {currentStep === 2 && (
                    <SelectPublicationStep
                      form={form}
                      organizationId={organizationId}
                      onBack={handleBack}
                    />
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
