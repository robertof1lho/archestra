"use client";

import type { archestraApiTypes } from "@archestra/shared";
import { MoreVertical, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WithRole } from "@/components/with-permission";
import { TransportBadges } from "./transport-badges";
import { UninstallServerDialog } from "./uninstall-server-dialog";
import {
  useLocalMcpRuntimeStatus,
  useMcpServerTools,
} from "@/lib/mcp-server.query";

export type CatalogItem =
  archestraApiTypes.GetInternalMcpCatalogResponses["200"][number];

export type CatalogItemWithOptionalLabel = CatalogItem & {
  label?: string | null;
};

export type InstalledServer =
  archestraApiTypes.GetMcpServersResponses["200"][number];

export type McpServerCardProps = {
  item: CatalogItemWithOptionalLabel;
  installedServer?: InstalledServer | null;
  installingItemId: string | null;
  installationStatus?:
    | "error"
    | "pending"
    | "success"
    | "idle"
    | "discovering-tools"
    | null;
  onInstall: () => void;
  onInstallNoAuth: () => void;
  onReinstall: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
};

export type McpServerCardVariant = "remote" | "local";

export type McpServerCardBaseProps = McpServerCardProps & {
  variant: McpServerCardVariant;
};

export function McpServerCard({
  variant,
  item,
  installedServer,
  installingItemId,
  installationStatus,
  onInstall,
  onInstallNoAuth,
  onReinstall,
  onEdit,
  onDelete,
  isAdmin,
}: McpServerCardBaseProps) {
  const [uninstallingServer, setUninstallingServer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { data: tools = [], isLoading: areToolsLoading } =
    useMcpServerTools(installedServer?.id ?? null);
  const shouldTrackRuntime =
    installedServer && installedServer.localInstallationStatus !== "idle";
  const { data: runtimeStatus } = useLocalMcpRuntimeStatus(
    shouldTrackRuntime ? installedServer.id : null,
  );
  const [showToolList, setShowToolList] = useState(false);

  const isInstalling = Boolean(
    installingItemId === item.id ||
      installationStatus === "pending" ||
      (installationStatus === "discovering-tools" && installedServer),
  );
  const needsReinstall = installedServer?.reinstallRequired ?? false;
  const installed = Boolean(installedServer);
  const requiresAuth =
    (item.userConfig && Object.keys(item.userConfig).length > 0) ||
    item.oauthConfig;
  const localInstalllingLabel =
    installationStatus === "discovering-tools" ? "Discovering..." : "Installing...";

  const runtimeBadgeVariant = useMemo(() => {
    if (!runtimeStatus) return "secondary";
    switch (runtimeStatus.status) {
      case "running":
        return "default";
      case "error":
        return "destructive";
      default:
        return "secondary";
    }
  }, [runtimeStatus]);

  const manageCatalogItemDropdownMenu = (
    <div className="flex flex-wrap gap-1 items-center flex-shrink-0 mt-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const remoteActions = (
    <div className="space-y-3">
      {needsReinstall && (
        <Button
          onClick={onReinstall}
          size="sm"
          variant="default"
          className="w-full"
          disabled={isInstalling}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {isInstalling ? "Reinstalling..." : "Reinstall Required"}
        </Button>
      )}
      <WithRole requiredExactRole="admin">
        <Button
          onClick={onInstall}
          disabled={isInstalling || installed}
          size="sm"
          variant="outline"
          className="w-full"
        >
          {installed
            ? "Installed"
            : isInstalling
              ? "Installing..."
              : "Install"}
        </Button>
      </WithRole>
      {requiresAuth && (
        <p className="text-xs text-muted-foreground">
          Authentication is required before tokens become available.
        </p>
      )}
    </div>
  );

  const localActions = (
    <WithRole requiredExactRole="admin">
      {installed ? (
        <Button
          onClick={() =>
            installedServer &&
            setUninstallingServer({
              id: installedServer.id,
              name: item.label || item.name,
            })
          }
          size="sm"
          variant="outline"
          className="w-full"
        >
          Uninstall
        </Button>
      ) : (
        <Button
          onClick={onInstallNoAuth}
          disabled={isInstalling}
          size="sm"
          variant="outline"
          className="w-full"
        >
          {isInstalling ? localInstalllingLabel : "Install"}
        </Button>
      )}
    </WithRole>
  );

  const dialogs = (
    <UninstallServerDialog
      server={uninstallingServer}
      onClose={() => setUninstallingServer(null)}
    />
  );

  return (
    <Card className="flex flex-col relative pt-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <CardTitle className="text-lg truncate mb-1 flex items-center">
              {item.name}
            </CardTitle>
            {runtimeStatus && (
              <Badge variant={runtimeBadgeVariant} className="mb-1">
                {runtimeStatus.status === "running"
                  ? `Running :${runtimeStatus.port}`
                  : `Status: ${runtimeStatus.status}`}
              </Badge>
            )}
            <div className="flex items-center gap-2">
              {item.oauthConfig && (
                <Badge variant="secondary" className="text-xs">
                  OAuth
                </Badge>
              )}
              <TransportBadges
                isRemote={variant === "remote"}
                transportType={item.localConfig?.transportType}
              />
              {variant === "remote" && !requiresAuth && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-green-700 text-white"
                >
                  No auth required
                </Badge>
              )}
            </div>
          </div>
          {isAdmin && manageCatalogItemDropdownMenu}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {item.description && (
          <p className="text-sm text-muted-foreground">{item.description}</p>
        )}
        {installedServer && (
          <div className="border-t border-border/60 pt-3 text-sm space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Tools available</span>
              <button
                type="button"
                onClick={() => setShowToolList((prev) => !prev)}
                className="font-semibold text-primary underline-offset-2 hover:underline"
                disabled={areToolsLoading}
              >
                {areToolsLoading
                  ? "Loading…"
                  : `${tools.length} tool${tools.length === 1 ? "" : "s"}`}
              </button>
            </div>
            {!areToolsLoading && tools.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No tools detected for this MCP server yet.
              </p>
            )}
            {!areToolsLoading && tools.length > 0 && showToolList && (
              <div className="flex flex-wrap gap-2 text-xs">
                {tools.map((tool) => (
                  <Badge key={tool.id} variant="outline" className="text-xs">
                    {tool.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
        {variant === "remote" ? remoteActions : localActions}
      </CardContent>
      {dialogs}
    </Card>
  );
}
