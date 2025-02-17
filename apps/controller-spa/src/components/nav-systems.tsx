import { Folder, Forward, type LucideIcon, MonitorCog, MoreHorizontal, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
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
            {
              /* <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem>
                  <Folder className="text-muted-foreground" />
                  <span>View System</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Forward className="text-muted-foreground" />
                  <span>Share System</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Trash2 className="text-muted-foreground" />
                  <span>Delete System</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu> */
            }
          </SidebarMenuItem>
        ))}
        {
          /* <SidebarMenuItem>
          <SidebarMenuButton className="text-sidebar-foreground/70">
            <MoreHorizontal className="text-sidebar-foreground/70" />
            <span>More</span>
          </SidebarMenuButton>
        </SidebarMenuItem> */
        }
      </SidebarMenu>
    </SidebarGroup>
  );
}
