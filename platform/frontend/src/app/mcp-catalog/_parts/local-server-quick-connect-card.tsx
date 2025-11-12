"use client";

import { AlertCircle, Loader2, PlugZap } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateInternalMcpCatalogItem } from "@/lib/internal-mcp-catalog.query";

const DEFAULT_NAME = "Local MCP Server";
const DEFAULT_URL = "http://127.0.0.1:8001/mcp";

export function LocalServerQuickConnectCard() {
  const [name, setName] = useState(DEFAULT_NAME);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateInternalMcpCatalogItem();

  const normalizedUrl = useMemo(() => url.trim(), [url]);

  const handleQuickAdd = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    try {
      const parsed = new URL(normalizedUrl);
      await createMutation.mutateAsync({
        name: name.trim(),
        serverType: "remote",
        serverUrl: parsed.toString(),
        userConfig: {},
      });
      setName(DEFAULT_NAME);
      setUrl(DEFAULT_URL);
    } catch (err) {
      if (err instanceof TypeError) {
        setError("Informe uma URL válida com http(s)://");
        return;
      }
      // Error toast already handled inside the mutation hook; fallback message for clarity.
      setError("Não foi possível criar o servidor. Verifique os logs.");
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <PlugZap className="h-4 w-4" />
         Simple Local MCP Server Connection
        </div>
        <CardTitle className="text-lg">Expose one MCP running on your computer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="local-mcp-name">Name</Label>
            <Input
              id="local-mcp-name"
              placeholder="Local MCP Server"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={createMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="local-mcp-url">Server URL</Label>
            <Input
              id="local-mcp-url"
              placeholder="http://127.0.0.1:8001/mcp"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={createMutation.isPending}
            />
          </div>
        </div>

        <Alert variant="default">
          <AlertDescription className="text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            If the platform is running inside a container/Docker, use
            <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
              http://host.docker.internal:8001/mcp
            </span>{" "}
            to reach the MCP running on your host.
          </AlertDescription>
        </Alert>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            onClick={handleQuickAdd}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adicionando...
              </>
            ) : (
              "Conectar"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
