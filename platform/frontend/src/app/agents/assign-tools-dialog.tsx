"use client";

import type { archestraApiTypes } from "@archestra/shared";
import { Loader2, Search, Server, ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAllAgentTools,
  useAssignTool,
  useUnassignTool,
} from "@/lib/agent-tools.query";
import { useTools } from "@/lib/tool.query";

interface AssignToolsDialogProps {
  agent: archestraApiTypes.GetAgentsResponses["200"][number];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignToolsDialog({
  agent,
  open,
  onOpenChange,
}: AssignToolsDialogProps) {
  // Fetch all tools and filter for MCP tools
  const { data: allTools, isLoading: isLoadingAllTools } = useTools({});
  const mcpTools = allTools?.filter((tool) => tool.mcpServer !== null) || [];

  type ToolData =
    archestraApiTypes.GetToolsResponses["200"] extends Array<infer T> ? T : never;
  type McpServerGroup = {
    serverId: string;
    serverName: string;
    tools: ToolData[];
    allTools: ToolData[];
  };

  const serverGroups = useMemo<McpServerGroup[]>(() => {
    if (!mcpTools.length) return [];
    const groups = new Map<string, McpServerGroup>();

    mcpTools.forEach((tool) => {
      const serverId = tool.mcpServer?.id;
      if (!serverId) return;
      const serverName = tool.mcpServer?.name || "Unnamed server";
      const existing = groups.get(serverId);
      if (existing) {
        existing.tools.push(tool);
        existing.allTools.push(tool);
      } else {
        groups.set(serverId, {
          serverId,
          serverName,
          tools: [tool],
          allTools: [tool],
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.serverName.localeCompare(b.serverName),
    );
  }, [mcpTools]);

  // Fetch currently assigned tools for this agent (use getAllAgentTools to get credentialSourceMcpServerId)
  const { data: allAgentTools } = useAllAgentTools({});
  const agentToolRelations = useMemo(
    () => allAgentTools?.filter((at) => at.agent.id === agent.id) || [],
    [allAgentTools, agent.id],
  );

  // Track selected tool IDs
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [expandedServers, setExpandedServers] = useState<
    Record<string, boolean>
  >({});
  const selectedToolCount = selectedToolIds.length;

  // Track search query
  const [searchQuery, setSearchQuery] = useState("");

  const filteredServerGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return serverGroups;
    }

    return serverGroups
      .map((group) => {
        const serverMatches = group.serverName.toLowerCase().includes(query);
        if (serverMatches) {
          return group;
        }
        const matchingTools = group.tools.filter((tool) =>
          tool.name.toLowerCase().includes(query),
        );
        if (matchingTools.length === 0) {
          return null;
        }
        return { ...group, tools: matchingTools };
      })
      .filter((group): group is McpServerGroup => group !== null);
  }, [serverGroups, searchQuery]);

  // Initialize selected tools when agent tools load
  useEffect(() => {
    if (agentToolRelations) {
      setSelectedToolIds(agentToolRelations.map((at) => at.tool.id));
    }
  }, [agentToolRelations]);

  const assignTool = useAssignTool();
  const unassignTool = useUnassignTool();

  const isLoading = isLoadingAllTools;
  const isSaving = assignTool.isPending || unassignTool.isPending;

  const handleToggleTool = useCallback((toolId: string) => {
    setSelectedToolIds((prev) => {
      const isSelected = prev.includes(toolId);
      if (isSelected) {
        return prev.filter((id) => id !== toolId);
      }
      return [...prev, toolId];
    });
  }, []);

  const handleToggleServer = useCallback(
    (tools: ToolData[], shouldSelect: boolean) => {
      setSelectedToolIds((prev) => {
        const updated = new Set(prev);
        if (shouldSelect) {
          tools.forEach((tool) => updated.add(tool.id));
        } else {
          tools.forEach((tool) => updated.delete(tool.id));
        }
        return Array.from(updated);
      });
    },
    [],
  );

  const handleServerExpansionChange = useCallback(
    (serverId: string, open: boolean) => {
      setExpandedServers((prev) => ({
        ...prev,
        [serverId]: open,
      }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    // Get current tool IDs and their state
    const currentToolIds = new Set(agentToolRelations.map((at) => at.tool.id));
    const selectedIds = new Set(selectedToolIds);

    // Determine which tools to assign, unassign, and update
    const toAssign = [...selectedIds].filter(
      (toolId) => !currentToolIds.has(toolId),
    );
    const toUnassign = agentToolRelations.filter(
      (at) => !selectedIds.has(at.tool.id),
    );

    try {
      // Assign new tools
      for (const toolId of toAssign) {
        await assignTool.mutateAsync({
          agentId: agent.id,
          toolId,
          credentialSourceMcpServerId: null,
        });
      }

      // Unassign removed tools
      for (const at of toUnassign) {
        await unassignTool.mutateAsync({
          agentId: agent.id,
          toolId: at.tool.id,
        });
      }

      toast.success(`Successfully updated tools for ${agent.name}`);

      onOpenChange(false);
    } catch (_error) {
      toast.error("Failed to update tool assignments");
    }
  }, [
    agent,
    agentToolRelations,
    assignTool,
    unassignTool,
    onOpenChange,
    selectedToolIds,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Tools to {agent.name}</DialogTitle>
          <DialogDescription>
            Select which MCP server tools this agent can access.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tools or servers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="text-sm text-muted-foreground">
          {selectedToolCount === 0
            ? "No tools selected"
            : `${selectedToolCount} tool${
                selectedToolCount === 1 ? "" : "s"
              } selected`}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : serverGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Server className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No MCP server tools available.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Install an MCP server to get started.
              </p>
            </div>
          ) : filteredServerGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-semibold">No tools found</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                No tools match "{searchQuery}". Try adjusting your search.
              </p>
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            </div>
          ) : (
            filteredServerGroups.map((group) => {
              const totalTools = group.allTools.length;
              const selectedInServer = group.allTools.filter((tool) =>
                selectedToolIds.includes(tool.id),
              ).length;
              const serverCheckboxState =
                selectedInServer === 0
                  ? false
                  : selectedInServer === totalTools
                    ? true
                    : "indeterminate";
              const isExpanded = !!expandedServers[group.serverId];
              return (
                <Collapsible
                  key={group.serverId}
                  open={isExpanded}
                  onOpenChange={(open) =>
                    handleServerExpansionChange(group.serverId, open)
                  }
                >
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`server-${group.serverId}`}
                          aria-label={`Assign all tools from ${group.serverName}`}
                          checked={serverCheckboxState}
                          onCheckedChange={(checked) =>
                            handleToggleServer(
                              group.allTools,
                              checked === true,
                            )
                          }
                          disabled={isSaving}
                        />
                        <div>
                          <p className="font-semibold">{group.serverName}</p>
                          <p className="text-xs text-muted-foreground">
                            {totalTools} tool{totalTools === 1 ? "" : "s"}{" "}
                            available
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {serverCheckboxState === true
                              ? "All tools from this server are selected."
                              : selectedInServer > 0
                                ? `${selectedInServer} of ${totalTools} selected.`
                                : "Select the entire server or choose specific tools."}
                          </p>
                        </div>
                      </div>
                      {totalTools > 0 && (
                        <div className="flex flex-col items-start gap-2 text-xs text-muted-foreground md:items-end">
                          <span>
                            {selectedInServer === 0
                              ? "No tools selected"
                              : `${selectedInServer} of ${totalTools} selected`}
                          </span>
                          <CollapsibleTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                            >
                              {isExpanded
                                ? "Hide tool list"
                                : "Choose specific tools"}
                              {isExpanded ? (
                                <ChevronUp className="ml-1 h-4 w-4" />
                              ) : (
                                <ChevronDown className="ml-1 h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      )}
                    </div>
                    <CollapsibleContent>
                      <div className="space-y-3 border-t border-border/60 pt-3">
                        {group.tools.map((tool) => {
                          const isSelected = selectedToolIds.includes(tool.id);
                          return (
                            <div
                              key={tool.id}
                              className="rounded-md border border-border/70 bg-muted/30 p-3"
                            >
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  id={`tool-${tool.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() =>
                                    handleToggleTool(tool.id)
                                  }
                                  disabled={isSaving}
                                />
                                <div className="flex-1 space-y-1">
                                  <Label
                                    htmlFor={`tool-${tool.id}`}
                                    className="text-sm font-medium leading-none cursor-pointer"
                                  >
                                    {tool.name}
                                  </Label>
                                  {tool.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {tool.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
