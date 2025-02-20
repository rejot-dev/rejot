import { useNavigate } from "react-router";
import { useSelectedOrganizationCode } from "@/data/clerk/clerk-meta.data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { SystemNewForm } from "./system-new.form";

export function SystemNew() {
  const navigate = useNavigate();
  const organizationCode = useSelectedOrganizationCode();
  const { toast } = useToast();

  if (!organizationCode) {
    return <div>No organization selected</div>;
  }

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
          <SystemNewForm
            id="create-system-form"
            onSuccess={async ({ slug }) => {
              toast({
                title: "Success",
                description: "System created successfully",
              });

              navigate(`/systems/${slug}`);
            }}
            onFailure={(error) => {
              toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to create system",
              });
            }}
            formControls={({ isSubmitting }) => (
              <Button type="submit" disabled={isSubmitting} className="self-start">
                Create System
              </Button>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
