import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";
import { useSelectedSystemSlug } from "@/app/system/system.state";
import type { SystemOverview } from "@/data/system/system.data";
import { DataStoreList } from "@/app/system/data-store/data-store-list";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";

interface CreateDataStoreStepProps {
  completed?: boolean;
  isLoading: boolean;
  systemOverview?: SystemOverview;
}

export function CreateDataStoreStep({
  completed = false,
  isLoading,
  systemOverview,
}: CreateDataStoreStepProps) {
  const systemSlug = useSelectedSystemSlug();

  if (!systemSlug) {
    return null;
  }

  return (
    <Card className={cn("animate-in fade-in slide-in-from-top-2 duration-200")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Data Stores</CardTitle>
          {completed && (
            <div className="rounded-full bg-green-500/10 p-1">
              <Check className="size-4 text-green-500" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground max-w-prose">
          Data stores are the sources and destinations for your synchronized data. Publications will
          be synchronized between data stores.
        </p>
        {completed && systemOverview && !isLoading && systemOverview.dataStores.length > 0 && (
          <DataStoreList systemSlug={systemSlug} showNewDataStoreButton={false} />
        )}
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button asChild>
          <Link to={`/systems/${systemSlug}/data-stores/new`}>
            <Plus className="size-4" />
            Add Data Store
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
