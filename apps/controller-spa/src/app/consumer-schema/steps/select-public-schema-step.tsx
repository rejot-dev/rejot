import { usePublicSchema, usePublicSchemas } from "@/data/public-schema/public-schema.data";
import { Loader2, TableProperties } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SchemaConfigurationEditor } from "@/app/public-schema/components/schema-configuration-editor";

interface SelectPublicSchemaStepProps {
  systemSlug: string;
  onBack: () => void;
  onSelected: (publicSchemaId: string) => void;
}

function PublicSchemaDetails({
  systemSlug,
  schemaId,
  onValidityChange,
}: {
  systemSlug: string;
  schemaId: string;
  onValidityChange: (isValid: boolean) => void;
}) {
  const { data: schema, isLoading } = usePublicSchema(systemSlug, schemaId);

  if (isLoading || !schema) {
    onValidityChange(false);
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading schema details...</span>
        </div>
      </Card>
    );
  }

  const latestTransformation = schema.transformations[schema.transformations.length - 1];
  if (!latestTransformation) {
    onValidityChange(false);
    return (
      <Card className="p-4">
        <Alert>
          <AlertDescription>
            This public schema has no transformations defined. Please select a different schema or
            create a transformation for this schema first.
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  if (!latestTransformation.schema?.length) {
    onValidityChange(false);
    return (
      <Card className="p-4">
        <Alert>
          <AlertDescription>
            This public schema has no columns defined. Please select a different schema or define
            columns for this schema first.
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  onValidityChange(true);
  return (
    <Card className="p-4">
      <h3 className="mb-4 text-lg font-medium">Schema Configuration</h3>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">Base Table:</span>
          <span className="text-muted-foreground">{latestTransformation.baseTable}</span>
        </div>
        <SchemaConfigurationEditor
          schema={latestTransformation.schema.map((col) => ({
            id: col.columnName,
            columnName: col.columnName,
            dataType: col.dataType,
          }))}
          onChange={() => {}}
          editable={false}
        />
      </div>
    </Card>
  );
}

export function SelectPublicSchemaStep({
  systemSlug,
  onBack,
  onSelected,
}: SelectPublicSchemaStepProps) {
  const { data: publicSchemas, isLoading } = usePublicSchemas(systemSlug);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [isSelectedSchemaValid, setIsSelectedSchemaValid] = useState(false);

  if (isLoading || !publicSchemas) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (!publicSchemas?.length) {
    return (
      <Alert>
        <AlertDescription>
          No public schemas available for this data store. Please create a public schema first.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <RadioGroup
        value={selectedSchema ?? undefined}
        onValueChange={setSelectedSchema}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {publicSchemas.map((schema) => (
          <div key={schema.id} className="relative">
            <RadioGroupItem value={schema.id} id={schema.id} className="sr-only" />
            <label htmlFor={schema.id} className="block cursor-pointer">
              <Card
                className={cn(
                  "hover:border-primary relative p-4 transition-colors",
                  selectedSchema === schema.id && "border-primary bg-primary/5",
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <TableProperties className="text-primary mt-1 size-5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-medium">{schema.name}</h4>
                        <Badge variant={schema.status === "active" ? "default" : "secondary"}>
                          {schema.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                {selectedSchema === schema.id && (
                  <div className="bg-primary absolute right-4 top-4 size-2 rounded-full" />
                )}
              </Card>
            </label>
          </div>
        ))}
      </RadioGroup>

      {selectedSchema ? (
        <PublicSchemaDetails
          systemSlug={systemSlug}
          schemaId={selectedSchema}
          onValidityChange={setIsSelectedSchemaValid}
        />
      ) : (
        <Card className="p-4">
          <div className="text-muted-foreground text-center">
            Select a public schema to view its details
          </div>
        </Card>
      )}

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={() => selectedSchema && onSelected(selectedSchema)}
          disabled={!selectedSchema || !isSelectedSchemaValid}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
