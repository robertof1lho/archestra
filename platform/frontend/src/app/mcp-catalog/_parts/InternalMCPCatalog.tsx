"use client";

import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { OAuthConfirmationDialog } from "@/components/oauth-confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRole } from "@/lib/auth.hook";
import { useInternalMcpCatalog } from "@/lib/internal-mcp-catalog.query";
import {
  useDeleteMcpServer,
  useInstallMcpServer,
  useMcpServerInstallationStatus,
  useMcpServers,
} from "@/lib/mcp-server.query";
import { CreateCatalogDialog } from "./create-catalog-dialog";
import { CustomServerRequestDialog } from "./custom-server-request-dialog";
import { DeleteCatalogDialog } from "./delete-catalog-dialog";
import { EditCatalogDialog } from "./edit-catalog-dialog";
import { LocalServerQuickConnectCard } from "./local-server-quick-connect-card";
import {
  type CatalogItem,
  type InstalledServer,
  McpServerCard,
} from "./mcp-server-card";
import { NoAuthInstallDialog } from "./no-auth-install-dialog";
import { ReinstallConfirmationDialog } from "./reinstall-confirmation-dialog";
import { RemoteServerInstallDialog } from "./remote-server-install-dialog";

export function InternalMCPCatalog({
  initialData,
  installedServers: initialInstalledServers,
}: {
  initialData?: CatalogItem[];
  installedServers?: InstalledServer[];
}) {
  const { data: catalogItems } = useInternalMcpCatalog({ initialData });
  const { data: installedServers } = useMcpServers({
    initialData: initialInstalledServers,
  });
  const installMutation = useInstallMcpServer();
  const userRole = useRole();
  const isAdmin = userRole === "admin";
  const deleteMutation = useDeleteMcpServer();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCustomRequestDialogOpen, setIsCustomRequestDialogOpen] =
    useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);
  const [installingItemId, setInstallingItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRemoteServerDialogOpen, setIsRemoteServerDialogOpen] =
    useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] =
    useState<CatalogItem | null>(null);
  const [isOAuthDialogOpen, setIsOAuthDialogOpen] = useState(false);
  const [showReinstallDialog, setShowReinstallDialog] = useState(false);
  const [catalogItemForReinstall, setCatalogItemForReinstall] =
    useState<CatalogItem | null>(null);
  const [isNoAuthDialogOpen, setIsNoAuthDialogOpen] = useState(false);
  const [noAuthCatalogItem, setNoAuthCatalogItem] =
    useState<CatalogItem | null>(null);
  const [installingServerIds, setInstallingServerIds] = useState<Set<string>>(
    new Set(),
  );

  // Poll installation status for the first installing server
  const mcpServerInstallationStatus = useMcpServerInstallationStatus(
    Array.from(installingServerIds)[0] ?? null,
  );

  // Remove server from installing set when installation completes
  useEffect(() => {
    const firstInstallingId = Array.from(installingServerIds)[0];
    if (firstInstallingId && mcpServerInstallationStatus.data === "success") {
      setInstallingServerIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(firstInstallingId);
        return newSet;
      });
    }
  }, [mcpServerInstallationStatus.data, installingServerIds]);

  const handleInstall = async (catalogItem: CatalogItem) => {

    // Check if this is a remote server with user configuration or it's the GitHub MCP server from the external catalog
    if (
      catalogItem.serverType === "remote" &&
      catalogItem.userConfig &&
      Object.keys(catalogItem.userConfig).length > 0
    ) {
      setSelectedCatalogItem(catalogItem);
      setIsRemoteServerDialogOpen(true);
      return;
    }

    // Check if this server requires OAuth authentication
    if (catalogItem.oauthConfig) {
      setSelectedCatalogItem(catalogItem);
      setIsOAuthDialogOpen(true);
      return;
    }

    // For servers without configuration, install directly
    setInstallingItemId(catalogItem.id);
    await installMutation.mutateAsync({
      name: catalogItem.name,
      catalogId: catalogItem.id,
    });
    setInstallingItemId(null);
  };

  const handleInstallNoAuth = async (catalogItem: CatalogItem) => {
    // Local servers (serverType !== "remote") install directly without dialog
    if (catalogItem.serverType !== "remote") {
      try {
        setInstallingItemId(catalogItem.id);
        const installedServer = await installMutation.mutateAsync({
          name: catalogItem.name,
          catalogId: catalogItem.id,
          dontShowToast: true,
        });
        // Track the installed server for polling
        if (installedServer?.id) {
          setInstallingServerIds((prev) =>
            new Set(prev).add(installedServer.id),
          );
        }
      } finally {
        setInstallingItemId(null);
      }
      return;
    }

    // Remote servers without auth show dialog before installation
    setNoAuthCatalogItem(catalogItem);
    setIsNoAuthDialogOpen(true);
  };

  const handleNoAuthConfirm = async () => {
    if (!noAuthCatalogItem) return;

    setInstallingItemId(noAuthCatalogItem.id);
    await installMutation.mutateAsync({
      name: noAuthCatalogItem.name,
      catalogId: noAuthCatalogItem.id,
    });
    setIsNoAuthDialogOpen(false);
    setNoAuthCatalogItem(null);
    setInstallingItemId(null);
  };

  const handleRemoteServerInstall = async (
    catalogItem: CatalogItem,
    metadata?: Record<string, unknown>,
  ) => {
    setInstallingItemId(catalogItem.id);

    // Extract access_token from metadata if present and pass as accessToken
    const accessToken =
      metadata?.access_token && typeof metadata.access_token === "string"
        ? metadata.access_token
        : undefined;

    await installMutation.mutateAsync({
      name: catalogItem.name,
      catalogId: catalogItem.id,
      ...(accessToken && { accessToken }),
    });
    setInstallingItemId(null);
  };

  const handleOAuthConfirm = async () => {
    if (!selectedCatalogItem) return;

    try {
      // Call backend to initiate OAuth flow
      const response = await fetch("/api/oauth/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          catalogId: selectedCatalogItem.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate OAuth flow");
      }

      const { authorizationUrl, state } = await response.json();

      // Store state in session storage for the callback
      sessionStorage.setItem("oauth_state", state);
      sessionStorage.setItem("oauth_catalog_id", selectedCatalogItem.id);

      // Redirect to OAuth provider
      window.location.href = authorizationUrl;
    } catch {
      toast.error("Failed to initiate OAuth flow");
    }
  };

  // Aggregate all installations of the same catalog item
  const getAggregatedInstallation = (catalogId: string) => {
    const servers = installedServers?.filter(
      (server) => server.catalogId === catalogId,
    );
    if (!servers || servers.length === 0) return undefined;
    return servers[0];
  };

  const handleReinstallRequired = async (
    catalogId: string,
    updatedData?: { name?: string; serverUrl?: string },
  ) => {
    // Check if there's an installed server from this catalog item
    const installedServer = installedServers?.find(
      (server) => server.catalogId === catalogId,
    );

    // Only show reinstall dialog if the server is actually installed
    if (!installedServer) {
      return;
    }

    // Wait a bit for queries to refetch after mutation
    // This ensures we have fresh catalog data
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Find the catalog item and show reinstall dialog
    let catalogItem = catalogItems?.find((item) => item.id === catalogId);

    // If we have updated data from the edit, merge it with the catalog item
    if (catalogItem && updatedData) {
      catalogItem = {
        ...catalogItem,
        ...(updatedData.name && { name: updatedData.name }),
        ...(updatedData.serverUrl && { serverUrl: updatedData.serverUrl }),
      };
    }

    if (catalogItem) {
      setCatalogItemForReinstall(catalogItem);
      setShowReinstallDialog(true);
    }
  };

  const handleReinstall = async (catalogItem: CatalogItem) => {
    // Get the installed server to get its ID (not catalog ID)
    const installedServer = installedServers?.find(
      (server) => server.catalogId === catalogItem.id,
    );
    if (!installedServer) {
      toast.error("Server not found, cannot reinstall");
      return;
    }

    // Delete the installed server using its server ID
    await deleteMutation.mutateAsync({
      id: installedServer.id,
      name: catalogItem.name,
    });

    // Then reinstall
    await handleInstall(catalogItem);
  };

  const sortInstalledFirst = (items: CatalogItem[]) =>
    [...items].sort((a, b) => {
      const aIsRemote = a.serverType === "remote";
      const bIsRemote = b.serverType === "remote";

      // First sort by server type (remote before local)
      if (aIsRemote && !bIsRemote) return -1;
      if (!aIsRemote && bIsRemote) return 1;

      return 0;
    });

  const filterCatalogItems = (items: CatalogItem[], query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;

    return items.filter((item) => {
      const labelText =
        typeof item.name === "string" ? item.name.toLowerCase() : "";
      return (
        item.name.toLowerCase().includes(normalizedQuery) ||
        labelText.includes(normalizedQuery)
      );
    });
  };

  const filteredCatalogItems = sortInstalledFirst(
    filterCatalogItems(catalogItems || [], searchQuery),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Private MCP Registry</h2>
          <p className="text-sm text-muted-foreground">
            MCP Servers from this registry can be assigned to your agents.
          </p>
        </div>
        <Button
          onClick={() =>
            isAdmin
              ? setIsCreateDialogOpen(true)
              : setIsCustomRequestDialogOpen(true)
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {isAdmin
            ? "Add MCP Server"
            : "Request to add custom MCP Server"}
        </Button>
      </div>
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search MCP servers by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {isAdmin && <LocalServerQuickConnectCard />}
        {filteredCatalogItems.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
            {filteredCatalogItems.map((item) => {
              const installedServer = getAggregatedInstallation(item.id);
              const isInstallInProgress =
                installedServer && installingServerIds.has(installedServer.id);

              return (
                  <McpServerCard
                    variant={item.serverType === "remote" ? "remote" : "local"}
                    key={item.id}
                    item={item}
                    installedServer={installedServer}
                  installingItemId={installingItemId}
                  installationStatus={
                    isInstallInProgress
                      ? mcpServerInstallationStatus.data
                      : undefined
                  }
                    onInstall={() => handleInstall(item)}
                  onInstallNoAuth={() => handleInstallNoAuth(item)}
                  onReinstall={() => handleReinstall(item)}
                  onEdit={() => setEditingItem(item)}
                  onDelete={() => setDeletingItem(item)}
                  isAdmin={isAdmin}
                />
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery.trim()
                ? `No MCP servers match "${searchQuery}".`
                : "No MCP servers found."}
            </p>
          </div>
        )}
      </div>

      <CreateCatalogDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />

      <CustomServerRequestDialog
        isOpen={isCustomRequestDialogOpen}
        onClose={() => setIsCustomRequestDialogOpen(false)}
      />

      <EditCatalogDialog
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onReinstallRequired={handleReinstallRequired}
      />

      <DeleteCatalogDialog
        item={deletingItem}
        onClose={() => setDeletingItem(null)}
        installationCount={
          deletingItem
            ? installedServers?.filter(
                (server) => server.catalogId === deletingItem.id,
              ).length || 0
            : 0
        }
      />

      <RemoteServerInstallDialog
        isOpen={isRemoteServerDialogOpen}
        onClose={() => {
          setIsRemoteServerDialogOpen(false);
          setSelectedCatalogItem(null);
        }}
        onInstall={handleRemoteServerInstall}
        catalogItem={selectedCatalogItem}
        isInstalling={installMutation.isPending}
      />

      <OAuthConfirmationDialog
        open={isOAuthDialogOpen}
        onOpenChange={setIsOAuthDialogOpen}
        serverName={selectedCatalogItem?.name || ""}
        onConfirm={handleOAuthConfirm}
        onCancel={() => {
          setIsOAuthDialogOpen(false);
          setSelectedCatalogItem(null);
        }}
      />

      <ReinstallConfirmationDialog
        isOpen={showReinstallDialog}
        onClose={() => {
          setShowReinstallDialog(false);
          setCatalogItemForReinstall(null);
        }}
        onConfirm={async () => {
          if (catalogItemForReinstall) {
            setShowReinstallDialog(false);
            await handleReinstall(catalogItemForReinstall);
            setCatalogItemForReinstall(null);
          }
        }}
        serverName={catalogItemForReinstall?.name || ""}
        isReinstalling={installMutation.isPending}
      />

      <NoAuthInstallDialog
        isOpen={isNoAuthDialogOpen}
        onClose={() => {
          setIsNoAuthDialogOpen(false);
          setNoAuthCatalogItem(null);
        }}
        onInstall={handleNoAuthConfirm}
        catalogItem={noAuthCatalogItem}
        isInstalling={installMutation.isPending}
      />
    </div>
  );
}
