import { create } from "zustand";
import { useEffect } from "react";
import { useSystems } from "../../data/system/system.data";
import { useLocation } from "react-router";

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

  useEffect(() => {
    const match = location.pathname.match(/\/systems\/([^/]+)/);
    if (match) {
      const systemSlug = match[1];
      if (systemSlug) {
        useSystemStore.getState().setSelectedSystemSlug(systemSlug);
      }
    }
  }, [location]);

  return useSystemStore((state) => state.selectedSystemSlug);
};

export const setSelectedSystemSlug = (slug: string) =>
  useSystemStore.getState().setSelectedSystemSlug(slug);
