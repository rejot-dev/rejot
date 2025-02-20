import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ComponentPropsWithoutRef } from "react";
import { ConnectionPostgresForm } from "./connection-types";

export type ConnectionNewPostgresFormData = z.infer<typeof ConnectionPostgresForm>;

type FormProps = Omit<ComponentPropsWithoutRef<"form">, "onSubmit">;

interface ConnectionNewPostgresFormProps extends FormProps {
  id: string;
  organizationId: string;
  isSubmitting?: boolean;
  onSubmit: (values: ConnectionNewPostgresFormData) => Promise<void>;
  formControls?: (formState: { isSubmitting?: boolean }) => React.ReactNode;
}

export function ConnectionNewPostgresForm({
  organizationId,
  isSubmitting,
  onSubmit,
  formControls: renderActions,
  ...props
}: ConnectionNewPostgresFormProps) {
  const form = useForm<ConnectionNewPostgresFormData>({
    resolver: zodResolver(ConnectionPostgresForm),
    defaultValues: {
      type: "postgres",
      slug: "",
      host: "",
      port: 5432,
      database: "",
      user: "",
      password: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      // Form will remain interactive if submission fails
      console.error("Form submission failed:", error);
    }
  });

  const { id, ...rest } = props;

  return (
    <Form {...form}>
      <form id={id} onSubmit={handleSubmit} className="space-y-4" {...rest}>
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="my-postgres-db" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="host"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Host</FormLabel>
              <FormControl>
                <Input placeholder="localhost" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="port"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Port</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="database"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Database</FormLabel>
              <FormControl>
                <Input placeholder="postgres" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="user"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="postgres" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {renderActions?.({ isSubmitting })}
      </form>
    </Form>
  );
}
