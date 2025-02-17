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
import { Database } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const formSchema = z.object({
  slug: z.string().min(1, "Name is required"),
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().min(1, "Port is required"),
  database: z.string().min(1, "Database name is required"),
  user: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export function ConnectionNew() {
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

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">New Connection</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:bg-accent transition-colors"
          onClick={() => navigate("postgres")}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>PostgreSQL</CardTitle>
            </div>
            <CardDescription>
              Connect to a PostgreSQL database to sync data
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Add more connection types here in the future */}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate("/connections")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
