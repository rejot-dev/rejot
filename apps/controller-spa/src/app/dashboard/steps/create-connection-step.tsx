import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CreateConnectionStepProps {
  completed?: boolean;
}

export function CreateConnectionStep({ completed = false }: CreateConnectionStepProps) {
  return (
    <Card
      className={cn(
        "animate-in fade-in slide-in-from-top-2 duration-200",
        completed && "border-green-500/30 bg-green-500/5",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Create a connection</CardTitle>
          {completed && (
            <div className="rounded-full bg-green-500/10 p-1">
              <Check className="size-4 text-green-500" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Connections define how ReJot interacts with your data sources. Currently supporting
          PostgreSQL databases, with more options coming soon.
        </p>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button asChild>
          <a href="/connections/new">Add Connection</a>
        </Button>
      </CardFooter>
    </Card>
  );
}
