export type SyncServiceStatus = "onboarding" | "active" | "paused";

export type SyncService = {
  code: string;
  slug: string;
  status: SyncServiceStatus;
};
