"use client";

import type { archestraApiTypes } from "@archestra/shared";
import { Code2, MoreVertical, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WithRole } from "@/components/with-permission";
import {
  useLocalMcpRuntimeStatus,
  useMcpServerTools,
} from "@/lib/mcp-server.query";
import { cn } from "@/lib/utils";
import { TransportBadges } from "./transport-badges";
import { UninstallServerDialog } from "./uninstall-server-dialog";

const AUTO_DESCRIPTION_REGEX = /^Generated via api2mcp on (.+)$/i;

function formatCatalogDescription(description?: string | null): string | null {
  if (!description) return null;
  const match = AUTO_DESCRIPTION_REGEX.exec(description.trim());
  if (!match) {
    return description;
  }
  const rawTimestamp = match[1].trim();
  const parsed = new Date(rawTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return description;
  }
  const formatted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(parsed);
  return `Generated via api2mcp • ${formatted} UTC`;
}

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
  const { data: tools = [], isLoading: areToolsLoading } = useMcpServerTools(
    installedServer?.id ?? null,
  );
  const shouldTrackRuntime =
    installedServer && installedServer.localInstallationStatus !== "idle";
  const { data: runtimeStatus } = useLocalMcpRuntimeStatus(
    shouldTrackRuntime ? installedServer.id : null,
  );
  const [isToolDialogOpen, setIsToolDialogOpen] = useState(false);
  const [isRuntimeDialogOpen, setIsRuntimeDialogOpen] = useState(false);
  const isInstalling = Boolean(
    installingItemId === item.id ||
      installationStatus === "pending" ||
      (installationStatus === "discovering-tools" && installedServer),
  );
  const needsReinstall = installedServer?.reinstallRequired ?? false;
  const installed = Boolean(installedServer);
  const localInstalllingLabel =
    installationStatus === "discovering-tools"
      ? "Discovering..."
      : "Installing...";

  const formattedDescription = useMemo(
    () => formatCatalogDescription(item.description),
    [item.description],
  );
  const isGeneratedServer = AUTO_DESCRIPTION_REGEX.test(item.description ?? "");
  const showRuntimeInsights =
    isGeneratedServer && Boolean(installedServer) && variant === "remote";
  const runtimeIsHealthy = runtimeStatus?.status === "running";
  const runtimeStatusLabel = runtimeStatus?.status ?? "unknown";
  const runtimeDotColor = runtimeIsHealthy ? "bg-emerald-500" : "bg-red-500";
  const runtimeGlowColor = runtimeIsHealthy
    ? "bg-emerald-400/70"
    : "bg-red-500/60";
  const runtimeIssueMessage =
    runtimeStatus?.error ||
    installedServer?.localInstallationError ||
    "No runtime diagnostics are available. Confirm the local MCP process is running.";
  const recentRuntimeLogs = useMemo(() => {
    if (!runtimeStatus?.logs) return [];
    const recent = runtimeStatus.logs.slice(-8);
    const baseIndex = runtimeStatus.logs.length - recent.length;
    return recent.map((line, idx) => ({
      line,
      key: `${runtimeStatus.serverId}-${baseIndex + idx}-${line}`,
    }));
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
          {installed ? "Installed" : isInstalling ? "Installing..." : "Install"}
        </Button>
      </WithRole>
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
    <>
      <UninstallServerDialog
        server={uninstallingServer}
        onClose={() => setUninstallingServer(null)}
      />
      <Dialog open={isRuntimeDialogOpen} onOpenChange={setIsRuntimeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Local runtime status</DialogTitle>
            <DialogDescription>
              {item.name} is currently {runtimeStatusLabel}.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {runtimeIssueMessage}
          </p>
          {recentRuntimeLogs.length > 0 && (
            <div className="mt-4 max-h-48 overflow-y-auto rounded border bg-muted/40 p-2 text-xs font-mono">
              {recentRuntimeLogs.map((entry) => (
                <div key={entry.key}>{entry.line}</div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isToolDialogOpen} onOpenChange={setIsToolDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tools available</DialogTitle>
            <DialogDescription>
              {installedServer
                ? `${item.name} exposes ${tools.length} tool${
                    tools.length === 1 ? "" : "s"
                  }.`
                : "Tools are only available after installation."}
            </DialogDescription>
          </DialogHeader>
          {areToolsLoading ? (
            <p className="text-sm text-muted-foreground">Loading tools…</p>
          ) : tools.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tools detected for this MCP server yet.
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1" role="list">
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  role="listitem"
                  className="flex items-start gap-3 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm"
                >
                  <Code2 className="mt-1 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-semibold font-mono">{tool.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {tool.description?.trim() ||
                        "No description provided for this tool."}
                    </p>
                    {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Params: {Object.keys(tool.parameters).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <Card className="flex flex-col relative pt-4">
      {showRuntimeInsights && (
        <div className="absolute left-2 top-2 flex h-3.2 w-3.2 items-center justify-center">
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 rounded-full blur-[2px] transition-all",
              "animate-gentle-glow",
              runtimeGlowColor,
              runtimeIsHealthy ? "opacity-70" : "opacity-90",
            )}
          />
          <button
            type="button"
            aria-label={
              runtimeIsHealthy
                ? "Local MCP server is running"
                : "Local MCP server is offline. Click to view details."
            }
            onClick={() => {
              if (!runtimeIsHealthy) {
                setIsRuntimeDialogOpen(true);
              }
            }}
            disabled={runtimeIsHealthy}
            className={cn(
              "relative z-10 h-3 w-3 rounded-full border-2 border-card shadow-sm transition-colors",
              "animate-gentle-blink",
              runtimeDotColor,
              runtimeIsHealthy ? "cursor-default" : "cursor-pointer",
            )}
          />
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <CardTitle className="text-lg truncate mb-1 flex items-center">
              {item.name}
            </CardTitle>
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
            </div>
          </div>
          {isAdmin && manageCatalogItemDropdownMenu}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {formattedDescription && (
          <p className="text-sm text-muted-foreground text-justify">
            {formattedDescription}
          </p>
        )}
        {showRuntimeInsights && (
          <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-muted-foreground">Local port</p>
                <p className="font-mono text-sm">
                  {runtimeStatus?.port
                    ? `:${runtimeStatus.port}`
                    : "Unavailable"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Runtime status</p>
                <p
                  className={cn(
                    "font-medium capitalize",
                    runtimeIsHealthy ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {runtimeStatusLabel}
                </p>
              </div>
            </div>
          </div>
        )}
        {installedServer && (
          <div className="border-t border-border/60 pt-3 text-sm space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Tools available</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setIsToolDialogOpen(true)}
                disabled={areToolsLoading || tools.length === 0}
              >
                {areToolsLoading
                  ? "Loading…"
                  : `View (${tools.length})`}
              </Button>
            </div>
          </div>
        )}
        {variant === "remote" ? remoteActions : localActions}
      </CardContent>
      {dialogs}
    </Card>
  );
}
