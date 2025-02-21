"use client";

import { ChevronRight, Database, FolderKanban, Home } from "lucide-react";
import { NavLink, useMatch } from "react-router";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useSelectedSystemSlug } from "@/app/system/system.state";

export function NavMain() {
  const selectedSystemSlug = useSelectedSystemSlug();
  const hasSelectedSystem = selectedSystemSlug !== null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Home" isActive={!!useMatch({ path: "/" })}>
            <NavLink to="/">
              <Home />
              <span>Home</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <Collapsible asChild defaultOpen={hasSelectedSystem} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild disabled={!hasSelectedSystem}>
              <SidebarMenuButton tooltip="System" disabled={!hasSelectedSystem}>
                <FolderKanban />
                <span>System</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    asChild
                    className={!hasSelectedSystem ? "pointer-events-none opacity-50" : ""}
                    isActive={!!useMatch({ path: `/systems/${selectedSystemSlug}` })}
                  >
                    <NavLink to={`/systems/${selectedSystemSlug}`}>
                      <span>Overview</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    asChild
                    className={!hasSelectedSystem ? "pointer-events-none opacity-50" : ""}
                    isActive={!!useMatch({ path: "/public-schemas" })}
                  >
                    <NavLink to="/public-schemas">
                      <span>Public Schemas</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>

        <Collapsible asChild className="group/collapsible" defaultOpen={true}>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip="Connections">
                <Database />
                <span>Connections</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={!!useMatch({ path: "/connections" })}>
                    <NavLink to="/connections">
                      <span>Overview</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>

        {/* <Collapsible asChild className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip="Settings">
                <Settings2 />
                <span>Settings</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild>
                    <NavLink to="/settings">
                      <span>General</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible> */}
      </SidebarMenu>
    </SidebarGroup>
  );
}
