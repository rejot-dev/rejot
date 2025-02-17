import * as React from "react";
import { GalleryVerticalEnd } from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavSystems } from "./nav-systems";
import { NavOnboarding } from "./nav-onboarding";
import { useClerkPublicMetadata } from "@/data/clerk/clerk-meta.data";
import { useOrganizations } from "@/data/organizations/organizations.data";

// This is sample data.
const data = {
  teams: [
    {
      name: "ReJot, Inc.",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const metadata = useClerkPublicMetadata();
  const { data } = useOrganizations();

  if (!metadata) {
    throw new Error("Sidebar should not be rendered if user is not signed in.");
  }

  if (!metadata.finishedOnboarding) {
    return (
      <Sidebar collapsible="icon" {...props}>
        <SidebarContent>
          <NavOnboarding />
        </SidebarContent>
      </Sidebar>
    );
  }

  if (!metadata.selectedOrganizationId) {
    throw new Error("Onboarding is finished but no organization is selected.");
  }

  const organizations = (data ?? []).map((org) => ({
    id: org.code,
    name: org.name,
  }));

  let selectedOrganization = organizations.find((org) =>
    org.id === metadata.selectedOrganizationId
  );

  if (!selectedOrganization) {
    selectedOrganization = {
      id: metadata.selectedOrganizationId,
      name: "",
    };
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrganizationSwitcher
          organizations={organizations.length > 0 ? organizations : [selectedOrganization]}
          selectedOrganization={selectedOrganization}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
        <NavSystems />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
