"use client";

import type { archestraApiTypes } from "@archestra/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2 } from "lucide-react";

type CatalogItem =
  archestraApiTypes.GetInternalMcpCatalogResponses["200"][number];

interface NoAuthInstallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => Promise<void>;
  catalogItem: CatalogItem | null;
  isInstalling: boolean;
}

export function NoAuthInstallDialog({
  isOpen,
  onClose,
  onInstall,
  catalogItem,
  isInstalling,
}: NoAuthInstallDialogProps) {
  const handleInstall = async () => {
    await onInstall();
  };

  if (!catalogItem) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <span>Install {catalogItem.name}</span>
          </DialogTitle>
          <DialogDescription>
            This MCP server does not require authentication and can be
            installed directly.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Alert>
            <AlertDescription>
              All users will have access to this MCP server once installed.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isInstalling}>
            Cancel
          </Button>
          <Button onClick={handleInstall} disabled={isInstalling}>
            {isInstalling ? "Installing..." : "Install"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
