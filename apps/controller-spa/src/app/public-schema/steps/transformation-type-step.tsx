import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Code2 } from "lucide-react";

interface TransformationTypeStepProps {
  onBack: () => void;
  onSelected: (type: "sql" | "typescript") => void;
}

export function TransformationTypeStep({ onBack, onSelected }: TransformationTypeStepProps) {
  const [selectedType, setSelectedType] = useState<"sql" | "typescript">("sql");

  return (
    <div className="space-y-6">
      <RadioGroup
        value={selectedType}
        onValueChange={(value) => setSelectedType(value as "sql" | "typescript")}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <div className="relative">
          <RadioGroupItem value="sql" id="sql" className="sr-only" />
          <label htmlFor="sql" className="block cursor-pointer">
            <Card
              className={cn(
                "relative p-4 transition-colors",
                "hover:border-primary hover:bg-primary/5",
                selectedType === "sql" && "border-primary bg-primary/5",
              )}
            >
              <CardHeader className="p-0">
                <div className="flex items-center gap-2">
                  <Code2 className="text-primary size-5" />
                  <CardTitle>SQL Transformation</CardTitle>
                </div>
                <CardDescription>Transform your data using SQL queries</CardDescription>
              </CardHeader>
              {selectedType === "sql" && (
                <div className="bg-primary absolute right-4 top-4 size-2 rounded-full" />
              )}
            </Card>
          </label>
        </div>

        <div className="relative">
          <RadioGroupItem value="typescript" id="typescript" className="sr-only" disabled />
          <label htmlFor="typescript" className="block cursor-pointer">
            <Card
              className={cn(
                "relative cursor-not-allowed p-4 opacity-50 transition-colors",
                selectedType === "typescript" && "border-primary bg-primary/5",
              )}
            >
              <CardHeader className="p-0">
                <div className="flex items-center gap-2">
                  <Code2 className="text-primary size-5" />
                  <CardTitle>TypeScript Transformation</CardTitle>
                </div>
                <CardDescription>
                  Transform your data using TypeScript (Coming Soon)
                </CardDescription>
              </CardHeader>
              {selectedType === "typescript" && (
                <div className="bg-primary absolute right-4 top-4 size-2 rounded-full" />
              )}
            </Card>
          </label>
        </div>
      </RadioGroup>

      <Card className="p-4">
        <h4 className="mb-3 text-sm font-medium">Transformation Type Details</h4>
        {selectedType === "sql" ? (
          <div className="text-muted-foreground grid gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-medium">Features</div>
              <ul className="list-disc space-y-1 pl-4">
                <li>Write SQL queries to transform your data</li>
                <li>Full access to PostgreSQL features</li>
                <li>Real-time data transformation</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            TypeScript transformations will be available in a future update
          </div>
        )}
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={() => onSelected(selectedType)} disabled={selectedType === "typescript"}>
          Continue
        </Button>
      </div>
    </div>
  );
}
