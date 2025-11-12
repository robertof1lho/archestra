"use client";
import {
  authLocalization,
  SignedIn,
  SignedOut,
  UserButton,
} from "@daveyplate/better-auth-ui";
import type { Role } from "@archestra/shared";
import {
  BookOpen,
  Bot,
  Bug,
  ClipboardList,
  Github,
  Info,
  LogIn,
  type LucideIcon,
  MessagesSquare,
  Router,
  Settings,
  ShieldCheck,
  Slack,
  Star,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ColorModeToggle } from "@/components/color-mode-toggle";
import { DefaultCredentialsWarning } from "@/components/default-credentials-warning";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { WithRole } from "@/components/with-permission";
import { useIsAuthenticated, useRole } from "@/lib/auth.hook";
import { useGithubStars } from "@/lib/github.query";

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  subItems?: MenuItem[];
}

const getNavigationItems = (
  isAuthenticated: boolean,
  role: Role,
): MenuItem[] => {
  return [
    ...(isAuthenticated
      ? [
          {
            title: "MCP Gateways",
            url: "/agents",
            icon: Bot,
          },
          {
            title: "Logs",
            url: "/logs/mcp-gateway",
            icon: MessagesSquare,
          },
          {
            title: "Tools",
            url: "/tools",
            icon: Wrench,
          },
          {
            title: "MCP Registry",
            url: "/mcp-catalog",
            icon: Router,
          },
        ]
      : []),
  ];
};

const actionItems: MenuItem[] = [
  {
    title: "Dual LLM",
    url: "/dual-llm",
    icon: ShieldCheck,
  },
];

const userItems: MenuItem[] = [
  {
    title: "Sign in",
    url: "/auth/sign-in",
    icon: LogIn,
  },
  // Sign up is disabled - users must use invitation links to join
];

export function AppSidebar() {
  const pathname = usePathname();
  const isAuthenticated = useIsAuthenticated();
  const role = useRole();
  const { data: starCount } = useGithubStars();

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center flex-row justify-between">
        <div className="flex items-center gap-2 px-2 py-2">
          <span className="text-base font-semibold">MCP Gateaway</span>
        </div>
        <ColorModeToggle />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {getNavigationItems(isAuthenticated, role).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={item.url === pathname}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.subItems && (
                    <SidebarMenuSub>
                      {item.subItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={subItem.url === pathname}
                          >
                            <Link href={subItem.url}>
                              {subItem.icon && <subItem.icon />}
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {/* <DefaultCredentialsWarning /> */}
        <SignedIn>
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <UserButton
                align="center"
                className="w-full bg-transparent hover:bg-transparent text-foreground"
                localization={{ ...authLocalization, SETTINGS: "Account" }}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        </SignedIn>
        <SignedOut>
          <SidebarGroupContent className="mb-4">
            <SidebarGroupLabel>User</SidebarGroupLabel>
            <SidebarMenu>
              {userItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={item.url === pathname}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SignedOut>
      </SidebarFooter>
    </Sidebar>
  );
}
