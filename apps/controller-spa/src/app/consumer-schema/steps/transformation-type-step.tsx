import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Database } from "lucide-react";

interface TransformationTypeStepProps {
  onBack: () => void;
  onSelected: (type: string) => void;
}

export function TransformationTypeStep({ onBack, onSelected }: TransformationTypeStepProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <RadioGroup
        value={selectedType ?? undefined}
        onValueChange={setSelectedType}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        <div className="relative">
          <RadioGroupItem value="postgresql" id="postgresql" className="sr-only" />
          <label htmlFor="postgresql" className="block cursor-pointer">
            <Card
              className={cn(
                "hover:border-primary relative p-4 transition-colors",
                selectedType === "postgresql" && "border-primary bg-primary/5",
              )}
            >
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <Database className="text-primary mt-1 size-5 shrink-0" />
                  <div>
                    <h4 className="text-base font-medium">PostgreSQL</h4>
                    <div className="text-muted-foreground mt-1 text-sm">
                      <span>SQL-based transformation</span>
                    </div>
                  </div>
                </div>
              </div>
              {selectedType === "postgresql" && (
                <div className="bg-primary absolute right-4 top-4 size-2 rounded-full" />
              )}
            </Card>
          </label>
        </div>
      </RadioGroup>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={() => selectedType && onSelected(selectedType)} disabled={!selectedType}>
          Continue
        </Button>
      </div>
    </div>
  );
}
