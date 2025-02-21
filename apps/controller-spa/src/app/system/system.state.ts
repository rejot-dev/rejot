import { create } from "zustand";
import { useEffect } from "react";
import { useLocation } from "react-router";
import { patchClerkMetadata, useDefaultSystemSlug } from "@/data/clerk/clerk-meta.data";

interface SystemState {
  selectedSystemSlug: string | null;
  setSelectedSystemSlug: (slug: string) => void;
}

const useSystemStore = create<SystemState>((set) => ({
  selectedSystemSlug: null,
  setSelectedSystemSlug: (slug) => set({ selectedSystemSlug: slug }),
}));

export const useSelectedSystemSlug = () => {
  const location = useLocation();
  const defaultSystemSlug = useDefaultSystemSlug();
  const selectedSystemSlug = useSystemStore((state) => state.selectedSystemSlug);

  useEffect(() => {
    const match = location.pathname.match(/\/systems\/([^/]+)/);
    if (match) {
      const systemSlug = match[1];
      if (systemSlug) {
        useSystemStore.getState().setSelectedSystemSlug(systemSlug);
      }
    }
  }, [location, selectedSystemSlug, defaultSystemSlug]);

  if (selectedSystemSlug) {
    return selectedSystemSlug;
  }

  if (defaultSystemSlug) {
    useSystemStore.getState().setSelectedSystemSlug(defaultSystemSlug);
    return defaultSystemSlug;
  }

  return defaultSystemSlug ?? null;
};

export const setSelectedSystemSlug = (slug: string) => {
  const state = useSystemStore.getState();

  if (state.selectedSystemSlug === slug) {
    return;
  }

  state.setSelectedSystemSlug(slug);

  patchClerkMetadata({
    defaultSystemSlug: slug,
  }).catch((error) => {
    console.error("Failed to set default system slug", error);
  });
};
