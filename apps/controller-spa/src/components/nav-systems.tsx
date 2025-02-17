import { MonitorCog } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { NavLink } from "react-router";
import { useCurrentOrganizationSystems } from "@/data/system/system.data";
import { setSelectedSystemSlug, useSelectedSystemSlug } from "@/app/system/system.state";

export function NavSystems() {
  const { data: systems, isLoading } = useCurrentOrganizationSystems();
  const selectedSystemSlug = useSelectedSystemSlug();

  if (isLoading || !systems) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Systems</SidebarGroupLabel>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Systems</SidebarGroupLabel>
      <SidebarMenu>
        {systems.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <NavLink
                onClick={() => setSelectedSystemSlug(item.slug)}
                to={{
                  pathname: `/systems/${item.slug}`,
                }}
                className={selectedSystemSlug === item.slug ? "font-semibold" : ""}
              >
                <MonitorCog />
                <span>{item.name}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
