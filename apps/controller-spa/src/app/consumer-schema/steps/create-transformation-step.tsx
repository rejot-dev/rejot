import { usePublicSchema } from "@/data/public-schema/public-schema.data";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SqlCodeMirror } from "@/app/public-schema/components/sql-code-mirror";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCreateConsumerSchemaMutation } from "@/data/consumer-schema/consumer-schema.data";
import { useToast } from "@/hooks/use-toast";

interface CreateTransformationStepProps {
  systemSlug: string;
  dataStoreSlug: string;
  publicSchemaId: string;
  onBack: () => void;
  onSuccess: (consumerSchemaId: string) => void;
}

export function CreateTransformationStep({
  systemSlug,
  dataStoreSlug,
  publicSchemaId,
  onBack,
  onSuccess,
}: CreateTransformationStepProps) {
  const { data: publicSchema, isLoading } = usePublicSchema(systemSlug, publicSchemaId);
  const [sql, setSql] = useState<string>("");
  const createMutation = useCreateConsumerSchemaMutation();
  const { toast } = useToast();

  if (isLoading || !publicSchema) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  // Get the latest transformation
  const latestTransformation =
    publicSchema.transformations[publicSchema.transformations.length - 1];
  if (!latestTransformation) {
    return (
      <Alert>
        <AlertDescription>No transformations found in the public schema.</AlertDescription>
      </Alert>
    );
  }

  // Generate initial SQL if not set
  if (!sql) {
    const columns = latestTransformation.schema.map((col) => col.columnName).join(", ");
    const initialSql = `INSERT INTO consumer_table (
  ${columns}
)
VALUES (
  'hello world'
);`;
    setSql(initialSql);
  }

  const handleCreate = async () => {
    try {
      const result = await createMutation.mutateAsync({
        systemSlug,
        dataStoreSlug,
        data: {
          name: `${publicSchema.name} Consumer`,
          publicSchemaId,
          details: {
            type: "postgresql",
            sql,
          },
        },
      });

      toast({
        title: "Success",
        description: "Consumer schema created successfully",
      });

      onSuccess(result.id);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create consumer schema",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <SqlCodeMirror
        className="h-[300px]"
        value={sql}
        onChange={setSql}
        baseTable={latestTransformation.baseTable}
        tableColumns={latestTransformation.schema.map((col) => ({ columnName: col.columnName }))}
        height="100%"
      />

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleCreate} disabled={!sql || createMutation.isPending}>
          {createMutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Consumer Schema"
          )}
        </Button>
      </div>
    </div>
  );
}
