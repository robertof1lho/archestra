"use client";

import type { archestraApiTypes } from "@archestra/shared";
import Divider from "@/components/divider";
import { PageContainer } from "@/components/page-container";
import { ExternalMCPCatalog } from "./_parts/ExternalMCPCatalog";
import { InternalMCPCatalog } from "./_parts/InternalMCPCatalog";

export default function McpRegistryPage({
  initialData,
}: {
  initialData: {
    catalog: archestraApiTypes.GetInternalMcpCatalogResponses["200"];
    servers: archestraApiTypes.GetMcpServersResponses["200"];
  };
}) {
  return (
    <div className="w-full h-full">
      <div className="border-b border-border bg-card/30">
        <PageContainer>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            MCP Registry
          </h1>
          <p className="text-sm text-muted-foreground">
            Self-hosted MCP registry allows you to manage your own list of MCP
            servers and make them available to your agents.
          </p>
        </PageContainer>
      </div>

      <PageContainer>
        <InternalMCPCatalog
          initialData={initialData.catalog}
          installedServers={initialData.servers}
        />
        <Divider className="my-8" />
        <ExternalMCPCatalog catalogItems={initialData.catalog} />
      </PageContainer>
    </div>
  );
}
