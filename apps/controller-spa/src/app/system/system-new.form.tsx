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
import { SlugSchema } from "@rejot/api-interface-controller/generic";
import { useEffect } from "react";
import { useCreateSystemMutation } from "@/data/system/system.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: SlugSchema,
});

export type SystemNewFormData = z.infer<typeof formSchema>;

type FormProps = Omit<ComponentPropsWithoutRef<"form">, "onSubmit">;

interface SystemNewFormProps extends FormProps {
  id: string;
  onSuccess?: (data: { slug: string }) => void;
  onFailure?: (error: Error) => void;
  formControls?: (formState: { isSubmitting: boolean }) => React.ReactNode;
}

export function SystemNewForm({
  formControls: renderActions,
  onSuccess,
  onFailure,
  ...props
}: SystemNewFormProps) {
  const organizationCode = useSelectedOrganizationCode();
  const createSystem = useCreateSystemMutation();
  const queryClient = useQueryClient();

  const form = useForm<SystemNewFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  // Watch the name field and update slug
  const name = form.watch("name");
  useEffect(() => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    form.setValue("slug", slug);
  }, [name, form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    if (!organizationCode) {
      onFailure?.(new Error("No organization selected"));
      return;
    }

    try {
      const result = await createSystem.mutateAsync({
        organizationId: organizationCode,
        name: data.name,
        slug: data.slug,
      });

      if (result.status === "error") {
        throw new Error("Failed to create system");
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["systems", organizationCode] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationCode, "systems"] });

      onSuccess?.({ slug: data.slug });
    } catch (error) {
      onFailure?.(error instanceof Error ? error : new Error("Failed to create system"));
    }
  });

  const { id, ...rest } = props;

  return (
    <Form {...form}>
      <form id={id} onSubmit={handleSubmit} className="space-y-4" {...rest}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>System Name</FormLabel>
              <FormControl>
                <Input placeholder="My System" className="w-full" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>System Slug</FormLabel>
              <FormControl>
                <Input
                  placeholder="my-system"
                  className="bg-muted w-full"
                  {...field}
                  disabled={true}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {renderActions?.({ isSubmitting: createSystem.isPending })}
      </form>
    </Form>
  );
}
