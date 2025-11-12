"use client";

import {
  archestraApiSdk,
  type archestraApiTypes,
  E2eTestId,
} from "@archestra/shared";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plug,
  Plus,
  Search,
  Server,
  Tag,
  Trash2,
  Wrench,
} from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/app/_parts/error-boundary";
import { type AgentLabel, AgentLabels } from "@/components/agent-labels";
import { LoadingSpinner } from "@/components/loading";
import { McpConnectionInstructions } from "@/components/mcp-connection-instructions";
import { ProxyConnectionInstructions } from "@/components/proxy-connection-instructions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WithRole } from "@/components/with-permission";
import {
  useAgents,
  useCreateAgent,
  useDeleteAgent,
  useLabelKeys,
  useLabelValues,
  useUpdateAgent,
} from "@/lib/agent.query";
import { useAssignTool } from "@/lib/agent-tools.query";
import { useTools } from "@/lib/tool.query";
import { AssignToolsDialog } from "./assign-tools-dialog";

export default function AgentsPage({
  initialData,
}: {
  initialData: archestraApiTypes.GetAgentsResponses["200"];
}) {
  return (
    <div className="w-full h-full">
      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <Agents initialData={initialData} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

function Agents({
  initialData,
}: {
  initialData: archestraApiTypes.GetAgentsResponses["200"];
}) {
  const { data: agents } = useAgents({ initialData });

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [connectingAgent, setConnectingAgent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [assigningToolsAgent, setAssigningToolsAgent] = useState<
    archestraApiTypes.GetAgentsResponses["200"][number] | null
  >(null);
  const [editingAgent, setEditingAgent] = useState<{
    id: string;
    name: string;
    labels: AgentLabel[];
  } | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);

  return (
    <div className="w-full h-full">
      <div className="border-b border-border bg-card/30">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight mb-2">
                MCP Gateways
              </h1>
              <p className="text-sm text-muted-foreground">
                MCP Gateways centralize access policies and auditing for every
                MCP tool they use, giving each workload a dedicated blast-radius
                on the gateway.
              </p>
            </div>
            <WithRole requiredExactRole="admin">
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                data-testid={E2eTestId.CreateAgentButton}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create MCP Gateway
              </Button>
            </WithRole>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {!agents || agents.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No MCP gateways found</CardTitle>
              <CardDescription>
                Create your first MCP gateway to get started with the Archestra
                Platform.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="px-6">
              <Table data-testid={E2eTestId.AgentsTable}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Connected Tools</TableHead>
                    <WithRole requiredExactRole="admin">
                      <TableHead className="text-right">Actions</TableHead>
                    </WithRole>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {agent.name}
                          {agent.isDefault && (
                            <Badge
                              variant="outline"
                              className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-xs font-bold"
                            >
                              DEFAULT
                            </Badge>
                          )}
                          {agent.labels && agent.labels.length > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex">
                                    <Tag className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {agent.labels.map((label) => (
                                      <Badge
                                        key={label.key}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        <span className="font-semibold">
                                          {label.key}:
                                        </span>
                                        <span className="ml-1">
                                          {label.value}
                                        </span>
                                      </Badge>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(agent.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "numeric",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{agent.tools.length}</TableCell>
                      <WithRole requiredExactRole="admin">
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      setConnectingAgent({
                                        id: agent.id,
                                        name: agent.name,
                                      })
                                    }
                                  >
                                    <Plug className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Connect</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      setAssigningToolsAgent(agent)
                                    }
                                  >
                                    <Wrench className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Assign Tools</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      setEditingAgent({
                                        id: agent.id,
                                        name: agent.name,
                                        labels: agent.labels || [],
                                      })
                                    }
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    data-testid={`${E2eTestId.DeleteAgentButton}-${agent.name}`}
                                    onClick={() => setDeletingAgentId(agent.id)}
                                    className="hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </WithRole>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {isCreateDialogOpen && (
          <CreateAgentDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          />
        )}

        {connectingAgent && (
          <ConnectAgentDialog
            agent={connectingAgent}
            open={!!connectingAgent}
            onOpenChange={(open) => !open && setConnectingAgent(null)}
          />
        )}

        {assigningToolsAgent && (
          <AssignToolsDialog
            agent={assigningToolsAgent}
            open={!!assigningToolsAgent}
            onOpenChange={(open) => !open && setAssigningToolsAgent(null)}
          />
        )}

        {editingAgent && (
          <EditAgentDialog
            agent={editingAgent}
            open={!!editingAgent}
            onOpenChange={(open) => !open && setEditingAgent(null)}
          />
        )}

        {deletingAgentId && (
          <DeleteAgentDialog
            agentId={deletingAgentId}
            open={!!deletingAgentId}
            onOpenChange={(open) => !open && setDeletingAgentId(null)}
          />
        )}
      </div>
    </div>
  );
}

function CreateAgentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [createdAgent, setCreatedAgent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [toolSearchQuery, setToolSearchQuery] = useState("");
  const [selectedTools, setSelectedTools] =
    useState<Record<string, true>>({});
  const [expandedServers, setExpandedServers] = useState<
    Record<string, boolean>
  >({});
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [isAssigningTools, setIsAssigningTools] = useState(false);
  const createAgent = useCreateAgent();
  const assignTool = useAssignTool();
  const { data: allTools } = useTools({});
  const isSubmitting = createAgent.isPending || isAssigningTools;

  type ToolData =
    archestraApiTypes.GetToolsResponses["200"] extends Array<infer T> ? T : never;
  type McpToolGroup = {
    serverId: string;
    serverName: string;
    catalogId?: string;
    tools: ToolData[];
  };

  const mcpToolGroups = useMemo<McpToolGroup[]>(() => {
    if (!allTools || !Array.isArray(allTools)) return [];
    const groups = new Map<string, McpToolGroup>();

    allTools.forEach((tool) => {
      if (!tool?.mcpServer?.id) return;
      const serverId = tool.mcpServer.id;
      const existing = groups.get(serverId);
      if (existing) {
        existing.tools.push(tool);
      } else {
        groups.set(serverId, {
          serverId,
          serverName: tool.mcpServer.name || "Unnamed server",
              catalogId:
                tool.mcpServer && "catalogId" in tool.mcpServer
                  ? (tool.mcpServer as { catalogId?: string }).catalogId ?? undefined
                  : undefined,
          tools: [tool],
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.serverName.localeCompare(b.serverName),
    );
  }, [allTools]);

  const filteredToolGroups = useMemo(() => {
    const query = toolSearchQuery.trim().toLowerCase();
    if (!query) {
      return mcpToolGroups;
    }

    return mcpToolGroups
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
      .filter((group): group is McpToolGroup => group !== null);
  }, [mcpToolGroups, toolSearchQuery]);

  const selectedToolCount = Object.keys(selectedTools).length;

  const handleToggleTool = useCallback((toolId: string) => {
    setSelectedTools((prev) => {
      if (prev[toolId]) {
        const { [toolId]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [toolId]: true,
      };
    });
  }, []);

  const handleToggleServer = useCallback(
    (tools: ToolData[], shouldSelect: boolean) => {
      setSelectedTools((prev) => {
        const updated = { ...prev };
        if (shouldSelect) {
          tools.forEach((tool) => {
            updated[tool.id] = true;
          });
        } else {
          tools.forEach((tool) => {
            delete updated[tool.id];
          });
        }
        return updated;
      });
    },
    [],
  );

  const toggleServerExpansion = useCallback((serverId: string) => {
    setExpandedServers((prev) => ({
      ...prev,
      [serverId]: !prev[serverId],
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
        toast.error("Please enter an MCP gateway name");
        return;
      }

      const selectedToolIds = Object.keys(selectedTools);
      let newlyCreatedAgent: archestraApiTypes.CreateAgentResponses["200"] | null =
        null;

      try {
        setAssignmentError(null);
        setIsAssigningTools(true);
        const createdResponse = await createAgent.mutateAsync({
          name: name.trim(),
          teams: [],
        });
        newlyCreatedAgent = createdResponse ?? null;
        if (!newlyCreatedAgent) {
          throw new Error("Failed to create MCP gateway");
        }
        if (selectedToolIds.length > 0) {
          for (const toolId of selectedToolIds) {
            await assignTool.mutateAsync({
              agentId: newlyCreatedAgent.id,
              toolId,
            });
          }
        }
        toast.success(
          selectedToolIds.length > 0
            ? "MCP gateway created and tools assigned"
            : "MCP gateway created successfully",
        );
        setCreatedAgent({
          id: newlyCreatedAgent.id,
          name: newlyCreatedAgent.name,
        });
      } catch (error) {
        if (newlyCreatedAgent) {
          setCreatedAgent({
            id: newlyCreatedAgent.id,
            name: newlyCreatedAgent.name,
          });
          setAssignmentError(
            "MCP gateway created, but assigning the selected MCP tools failed. You can manage tool access from the MCP Gateways table.",
          );
          toast.error("MCP gateway created, but assigning tools failed");
        } else {
          toast.error("Failed to create MCP gateway");
        }
      }

      setIsAssigningTools(false);
    },
    [name, selectedTools, createAgent, assignTool],
  );

  const handleClose = useCallback(() => {
    setName("");
    setCreatedAgent(null);
    setSelectedTools({});
    setToolSearchQuery("");
    setAssignmentError(null);
    setExpandedServers({});
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {!createdAgent ? (
          <>
            <DialogHeader>
              <DialogTitle>Create new MCP gateway</DialogTitle>
              <DialogDescription>
                Create a new MCP gateway to use with the plataform.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="grid gap-4 overflow-y-auto pr-2 pb-4 space-y-2">
                <div className="grid gap-2">
                  <Label htmlFor="name">Gateway Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My MCP Gateway"
                    autoFocus
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <Label>Assign MCP tools (optional)</Label>
                    <p className="text-sm text-muted-foreground">
                      Select MCP server tools to assign immediately after the
                      gateway is created. You can manage tools later from the
                      MCP Gateways table.
                    </p>
                  </div>
                  {mcpToolGroups.length === 0 ? (
                    <div className="flex items-center gap-3 rounded border border-dashed p-4 text-sm text-muted-foreground">
                      <Server className="h-4 w-4" />
                      <span>
                        No MCP server tools available. Install a server to
                        assign tools during creation.
                      </span>
                    </div>
                  ) : (
                    <div className="rounded border p-4 space-y-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="text-sm text-muted-foreground">
                          {selectedToolCount === 0
                            ? "No tools selected"
                            : `${selectedToolCount} tool${
                                selectedToolCount === 1 ? "" : "s"
                              } selected`}
                        </div>
                        <div className="relative w-full md:w-72">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={toolSearchQuery}
                            onChange={(event) =>
                              setToolSearchQuery(event.target.value)
                            }
                            placeholder="Search tools or servers..."
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div className="max-h-72 overflow-y-auto space-y-3 pr-2">
                        {filteredToolGroups.length === 0 ? (
                          <div className="text-center text-sm text-muted-foreground py-6">
                            No tools match "{toolSearchQuery.trim()}".
                          </div>
                        ) : (
                          filteredToolGroups.map((group) => {
                            const selectedInServer = group.tools.filter(
                              (tool) => !!selectedTools[tool.id],
                            ).length;
                            const allSelectedForServer =
                              group.tools.length > 0 &&
                              selectedInServer === group.tools.length;
                            const serverCheckboxState = allSelectedForServer
                              ? true
                              : selectedInServer > 0
                                ? "indeterminate"
                                : false;
                            const isExpanded =
                              !!expandedServers[group.serverId];
                            return (
                              <div
                                key={group.serverId}
                                className="rounded-lg border p-3 space-y-3"
                              >
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      id={`server-${group.serverId}`}
                                      checked={serverCheckboxState}
                                      onCheckedChange={(checked) =>
                                        handleToggleServer(
                                          group.tools,
                                          checked === true,
                                        )
                                      }
                                      disabled={isSubmitting}
                                    />
                                    <div>
                                      <p className="font-semibold">
                                        {group.serverName}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {group.tools.length} tool
                                        {group.tools.length === 1 ? "" : "s"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span>
                                      {selectedInServer === 0
                                        ? "No tools selected"
                                        : `${selectedInServer} of ${group.tools.length} tool${
                                            group.tools.length === 1 ? "" : "s"
                                          } selected`}
                                    </span>
                                    {group.tools.length > 0 && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          toggleServerExpansion(group.serverId)
                                        }
                                      >
                                        {isExpanded ? (
                                          <>
                                            Hide tools
                                            <ChevronUp className="ml-1 h-4 w-4" />
                                          </>
                                        ) : (
                                          <>
                                            Customize tools
                                            <ChevronDown className="ml-1 h-4 w-4" />
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="space-y-3">
                                    {group.tools.map((tool) => {
                                      const isSelected =
                                        !!selectedTools[tool.id];
                                      return (
                                        <div
                                          key={tool.id}
                                          className="rounded-md border p-3 space-y-2"
                                        >
                                          <div className="flex items-start gap-3">
                                            <Checkbox
                                              id={`tool-${tool.id}`}
                                              checked={isSelected}
                                              onCheckedChange={() =>
                                                handleToggleTool(tool.id)
                                              }
                                              disabled={isSubmitting}
                                            />
                                            <div className="flex-1 space-y-1">
                                              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                  <p className="font-medium">
                                                    {tool.name}
                                                  </p>
                                                  {tool.description && (
                                                    <p className="text-xs text-muted-foreground">
                                                      {tool.description}
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create MCP gateway"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                How to connect MCP gateway "{createdAgent.name}" to Archestra
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto py-4 flex-1 space-y-3">
              {assignmentError && (
                <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {assignmentError}
                </div>
              )}
              <AgentConnectionTabs agentId={createdAgent.id} />
            </div>
            <DialogFooter className="shrink-0">
              <Button
                type="button"
                onClick={handleClose}
                data-testid={E2eTestId.CreateAgentCloseHowToConnectButton}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditAgentDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: {
    id: string;
    name: string;
    labels: AgentLabel[];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(agent.name);
  const [labels, setLabels] = useState<AgentLabel[]>(agent.labels || []);
  const { data: availableKeys = [] } = useLabelKeys();
  const { data: availableValues = [] } = useLabelValues();
  const updateAgent = useUpdateAgent();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
        toast.error("Please enter an MCP gateway name");
        return;
      }

      try {
        await updateAgent.mutateAsync({
          id: agent.id,
          data: {
            name: name.trim(),
            labels,
          },
        });
        toast.success("MCP gateway updated successfully");
        onOpenChange(false);
      } catch (_error) {
        toast.error("Failed to update MCP gateway");
      }
    },
    [agent.id, name, labels, updateAgent, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit MCP gateway</DialogTitle>
          <DialogDescription>
            Update the MCP gateway name.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="grid gap-4 overflow-y-auto pr-2 pb-4 space-y-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Gateway Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My MCP Gateway"
                autoFocus
              />
            </div>
            <AgentLabels
              labels={labels}
              onLabelsChange={setLabels}
              availableKeys={availableKeys}
              availableValues={availableValues}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateAgent.isPending}>
              {updateAgent.isPending ? "Updating..." : "Update MCP gateway"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AgentConnectionTabs({ agentId }: { agentId: string }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <h3 className="font-medium">LLM Proxy</h3>
          <h4 className="text-sm text-muted-foreground">
            For security, observibility and enabling tools
          </h4>
        </div>
        <ProxyConnectionInstructions agentId={agentId} />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <h3 className="font-medium">MCP Gateway</h3>
          <h4 className="text-sm text-muted-foreground">
            To enable tools for the MCP gateway
          </h4>
        </div>
        <McpConnectionInstructions agentId={agentId} />
      </div>
    </div>
  );
}

function ConnectAgentDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            How to connect MCP gateway "{agent.name}" to Archestra
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <AgentConnectionTabs agentId={agent.id} />
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAgentDialog({
  agentId,
  open,
  onOpenChange,
}: {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteAgent = useDeleteAgent();

  const handleDelete = useCallback(async () => {
    try {
      await deleteAgent.mutateAsync(agentId);
      toast.success("MCP gateway deleted successfully");
      onOpenChange(false);
    } catch (_error) {
      toast.error("Failed to delete MCP gateway");
    }
  }, [agentId, deleteAgent, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Delete MCP gateway</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this MCP gateway? This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteAgent.isPending}
          >
            {deleteAgent.isPending ? "Deleting..." : "Delete MCP gateway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
