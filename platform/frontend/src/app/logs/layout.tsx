"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { cn } from "@/lib/utils";

export default function LogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Determine active tab
  const isMcpGatewayActive =
    pathname === "/logs/mcp-gateway" ||
    pathname?.startsWith("/logs/mcp-gateway/");

  if (pathname === "/logs") {
    if (typeof window !== "undefined") {
      window.location.href = "/logs/mcp-gateway";
    }
    return null;
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-border bg-card/30">
        <PageContainer className="py-8">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Logs</h1>
          <p className="text-sm text-muted-foreground">
            Inspect gateway activity, request traces, and runtime diagnostics for
            every MCP server managed by the platform. 
          </p>
        </PageContainer>
      </div>
      {children}
    </div>
  );
}
