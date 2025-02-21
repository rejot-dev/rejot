import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { createPublicSchema } from "@/data/public-schema/public-schema.data";
import { useConnectionTableSchema } from "@/data/connection/connection-health.data";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

interface ColumnSchema {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  tableSchema: string;
}

interface CreateTransformationStepProps {
  systemSlug: string;
  dataStoreSlug: string;
  baseTable: string;
  onBack: () => void;
  onSuccess: (publicSchemaId: string) => void;
}

export function CreateTransformationStep({
  systemSlug,
  dataStoreSlug,
  baseTable,
  onBack,
  onSuccess,
}: CreateTransformationStepProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [sqlQuery, setSqlQuery] = useState(`SELECT *\nFROM ${baseTable}`);
  const { data: columns, isLoading } = useConnectionTableSchema(
    systemSlug,
    dataStoreSlug,
    baseTable,
  );
  const createMutation = useMutation({
    mutationFn: (params: {
      systemSlug: string;
      dataStoreSlug: string;
      name: string;
      schema: ColumnSchema[];
    }) =>
      createPublicSchema(params.systemSlug, params.dataStoreSlug, {
        name: params.name,
        schema: params.schema,
      }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  const handleCreate = async () => {
    if (!name || !sqlQuery) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        systemSlug,
        dataStoreSlug,
        name,
        schema: columns ?? [],
      });

      toast({
        title: "Public schema created",
        description: "Your public schema has been created successfully",
      });

      onSuccess(result.id);
    } catch (error) {
      toast({
        title: "Error creating public schema",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Enter a name for your public schema"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sql">SQL Transformation</Label>
            <textarea
              id="sql"
              placeholder="Enter your SQL transformation"
              value={sqlQuery}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSqlQuery(e.target.value)}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              rows={10}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleCreate} disabled={createMutation.isPending}>
          {createMutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Public Schema"
          )}
        </Button>
      </div>
    </div>
  );
}
