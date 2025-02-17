import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCreateConnectionMutation } from "@/data/connection/connection.data";
import { useQueryClient } from "@tanstack/react-query";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";

const formSchema = z.object({
  slug: z.string().min(1, "Name is required"),
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().min(1, "Port is required"),
  database: z.string().min(1, "Database name is required"),
  user: z.string().min(1, "Username is required"),
  password: z.string(),
});

export function ConnectionNewPostgres() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organizationId = useSelectedOrganizationCode();
  const createMutation = useCreateConnectionMutation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: "",
      host: "",
      port: 5432,
      database: "",
      user: "",
      password: "",
    },
  });

  if (!organizationId) {
    return null;
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!organizationId) {
      return;
    }

    const result = await createMutation.mutateAsync({
      organizationId,
      data: {
        slug: values.slug,
        type: "postgres",
        config: {
          host: values.host,
          port: values.port,
          database: values.database,
          user: values.user,
          password: values.password,
        },
      },
    });

    if (result.status === "success") {
      await queryClient.invalidateQueries({ queryKey: ["connections"] });
      navigate("/connections");
    }
  }

  return (
    <div className="p-4 max-w-prose min-w-96 mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">New PostgreSQL Connection</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate("/connections/new")}>
              Back
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Create Connection
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
