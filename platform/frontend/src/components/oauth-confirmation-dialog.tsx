"use client";

import { Info, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OAuthConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function OAuthConfirmationDialog({
  open,
  onOpenChange,
  serverName,
  onConfirm,
  onCancel,
}: OAuthConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" />
                OAuth
              </Badge>
              <span className="text-base font-semibold">{serverName}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You will be redirected to the provider to authorize access for
              this MCP server. After authentication, the installation will
              continue automatically.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-3 sm:gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700 text-white">
            Continue to Authorization...
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
