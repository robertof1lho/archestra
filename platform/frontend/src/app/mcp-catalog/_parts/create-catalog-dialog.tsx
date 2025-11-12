"use client";

import type { archestraApiTypes } from "@archestra/shared";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateInternalMcpCatalogItem } from "@/lib/internal-mcp-catalog.query";
import { McpCatalogForm } from "./mcp-catalog-form";
import type { McpCatalogFormValues } from "./mcp-catalog-form.types";
import { transformFormToApiData } from "./mcp-catalog-form.utils";
import { Api2McpGenerator } from "./api2mcp-generator";

interface CreateCatalogDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type ServerType =
  archestraApiTypes.CreateInternalMcpCatalogItemData["body"]["serverType"];
type TabValue = ServerType | "api2mcp";

export function CreateCatalogDialog({
  isOpen,
  onClose,
}: CreateCatalogDialogProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("remote");
  const createMutation = useCreateInternalMcpCatalogItem();
  const remoteSubmitHandlerRef = useRef<(() => void) | null>(null);
  const localSubmitHandlerRef = useRef<(() => void) | null>(null);

  const handleClose = () => {
    setActiveTab("remote");
    onClose();
  };

  const onSubmit = async (values: McpCatalogFormValues) => {
    const apiData = transformFormToApiData(values);
    await createMutation.mutateAsync(apiData);
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as TabValue);
          }}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="remote">Remote</TabsTrigger>
            <TabsTrigger value="local">Local</TabsTrigger>
            <TabsTrigger value="api2mcp">Generate (API2MCP)</TabsTrigger>
          </TabsList>

          <TabsContent value="remote" className="space-y-4 mt-4">
            <McpCatalogForm
              mode="create"
              onSubmit={onSubmit}
              submitHandlerRef={remoteSubmitHandlerRef}
              serverType="remote"
            />
          </TabsContent>

          <TabsContent value="local" className="space-y-4 mt-4">
            <McpCatalogForm
              mode="create"
              onSubmit={onSubmit}
              submitHandlerRef={localSubmitHandlerRef}
              serverType="local"
            />
          </TabsContent>

          <TabsContent value="api2mcp" className="mt-4">
            <Api2McpGenerator onGenerationComplete={handleClose} />
          </TabsContent>
        </Tabs>

        {activeTab !== "api2mcp" && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} type="button">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const handler =
                  (activeTab === "local"
                    ? localSubmitHandlerRef
                    : remoteSubmitHandlerRef
                  ).current ?? null;
                handler?.();
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Adding..." : "Add Server"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
