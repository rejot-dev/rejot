import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Connection } from "./data-store.types";
import { type UseFormReturn } from "react-hook-form";
import { type DataStoreFormValues } from "./data-store.types";

interface ConnectionSelectorProps {
  form: UseFormReturn<DataStoreFormValues>;
  connections: Connection[];
}

export function ConnectionSelector({ form, connections }: ConnectionSelectorProps) {
  return (
    <FormField
      control={form.control}
      name="connectionSlug"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Connection</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select a connection" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {connections.map((connection) => (
                <SelectItem key={connection.slug} value={connection.slug}>
                  {connection.config.database} ({connection.config.host})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
