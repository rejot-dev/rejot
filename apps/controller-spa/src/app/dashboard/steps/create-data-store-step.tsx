import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CreateDataStoreStepProps {
  completed?: boolean;
}

export function CreateDataStoreStep({ completed = false }: CreateDataStoreStepProps) {
  return (
    <Card
      className={cn(
        "animate-in fade-in slide-in-from-top-2 duration-200",
        completed && "border-green-500/30 bg-green-500/5",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Getting Started with Data Stores</CardTitle>
          {completed && (
            <div className="rounded-full bg-green-500/10 p-1">
              <Check className="size-4 text-green-500" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Data stores are the destination for your synchronized data. They provide a reliable and
          efficient way to store and access your integration data.
        </p>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button asChild>
          <a href="/stores/new">Create Store</a>
        </Button>
      </CardFooter>
    </Card>
  );
}
