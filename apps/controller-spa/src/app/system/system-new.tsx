import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateSystemMutation } from "@/data/system/system.data";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, {
      message: "Slug must contain only lowercase letters, numbers, and hyphens",
    }),
});

type FormData = z.infer<typeof formSchema>;

export function SystemNew() {
  const navigate = useNavigate();
  const organizationCode = useSelectedOrganizationCode();
  const createSystem = useCreateSystemMutation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  if (!organizationCode) {
    return <div>No organization selected</div>;
  }

  // Watch the name field and update slug
  const name = form.watch("name");
  useEffect(() => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    form.setValue("slug", slug);
  }, [name, form]);

  const onSubmit = async (data: FormData) => {
    try {
      const result = await createSystem.mutateAsync({
        organizationId: organizationCode,
        name: data.name,
        slug: data.slug,
      });

      if (result.status === "error") {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create system",
        });
        return;
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["systems", organizationCode] });
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationCode, "systems"] });

      toast({
        title: "Success",
        description: "System created successfully",
      });

      navigate(`/systems/${data.slug}`);
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create system",
      });
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card className="bg-sidebar">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Create New System</CardTitle>
          <CardDescription className="text-muted-foreground">
            Create a new system to manage your data synchronization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 dark:text-gray-300">System Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My System" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 dark:text-gray-300">System Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="my-system" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="self-start">
                Create System
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
