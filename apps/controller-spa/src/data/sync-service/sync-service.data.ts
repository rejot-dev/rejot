import { useMutation } from "@tanstack/react-query";
import { syncServiceStartApi } from "@rejot-dev/api-interface-controller/sync-service";
import { fetchRouteThrowing } from "../fetch";
import { z } from "zod";

export type SyncServiceStatus = "onboarding" | "active" | "paused";

export type SyncService = {
  code: string;
  slug: string;
  status: SyncServiceStatus;
};

export type StartSyncMutationVariables = {
  systemSlug: string;
  dataStoreSlug: string;
};

export function startSync({
  systemSlug,
  dataStoreSlug,
}: StartSyncMutationVariables): Promise<
  z.infer<(typeof syncServiceStartApi.responses)[200]["content"]["application/json"]["schema"]>
> {
  return fetchRouteThrowing(syncServiceStartApi, {
    params: { systemSlug, dataStoreSlug },
  });
}

export function useStartSyncMutation() {
  return useMutation({
    mutationFn: startSync,
  });
}
