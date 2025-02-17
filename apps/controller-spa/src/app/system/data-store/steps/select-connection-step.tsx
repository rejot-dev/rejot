import { Button } from "@/components/ui/button";
import { ConnectionSelector } from "../connection-selector";
import type { UseFormReturn } from "react-hook-form";
import type { Connection, DataStoreFormValues } from "../data-store.types";

interface SelectConnectionStepProps {
  form: UseFormReturn<DataStoreFormValues>;
  connections: Connection[];
  onContinue: () => void;
}

export function SelectConnectionStep({ form, connections, onContinue }: SelectConnectionStepProps) {
  return (
    <div className="space-y-6">
      <ConnectionSelector form={form} connections={connections} />
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={onContinue}
          disabled={!form.watch("connectionSlug")}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
