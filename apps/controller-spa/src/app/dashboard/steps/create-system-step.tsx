import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { SystemList } from "../../system/system-list";
import { useToast } from "@/hooks/use-toast";
import { SystemNewForm } from "../../system/system-new.form";
import { setSelectedSystemSlug } from "@/app/system/system.state";

interface CreateSystemStepProps {
  completed?: boolean;
  onComplete?: (data: { slug: string }) => void;
}

export function CreateSystemStep({ completed = false, onComplete }: CreateSystemStepProps) {
  const { toast } = useToast();

  return (
    <Card className={cn("animate-in fade-in slide-in-from-top-2 duration-200")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Systems</CardTitle>
          {completed && (
            <div className="rounded-full bg-green-500/10 p-1">
              <Check className="size-4 text-green-500" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground max-w-prose">
          A system represents a collection of connections and data stores. The system typically
          encompasses all data stores within a single organization. In a database-per-domain
          architecture, the system gives a rough overview of a company&apos;s domain.
        </p>

        {completed ? (
          <>
            <p className="text-muted-foreground max-w-prose">
              Click any of the systems below to manage your connections and data stores.
            </p>
            <SystemList />
          </>
        ) : (
          <></>
        )}
      </CardContent>
      {!completed && (
        <CardFooter className="border-t px-6 py-4">
          <SystemNewForm
            className="w-full space-y-4 md:w-96"
            id="create-system-form"
            onSuccess={({ slug }) => {
              toast({
                title: "Success",
                description: "System created successfully",
              });
              setSelectedSystemSlug(slug);
              onComplete?.({ slug });
            }}
            onFailure={(error) => {
              toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
              });
            }}
            formControls={({ isSubmitting }) => (
              <Button type="submit" disabled={isSubmitting}>
                Create System
              </Button>
            )}
          />
        </CardFooter>
      )}
    </Card>
  );
}
