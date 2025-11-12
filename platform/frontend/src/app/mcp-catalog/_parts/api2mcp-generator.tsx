"use client";

import { FilePlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useGenerateApi2McpServer } from "@/lib/internal-mcp-catalog.query";

type InputMode = "paste" | "upload" | "url";

export function Api2McpGenerator({
  onGenerationComplete,
}: {
  onGenerationComplete?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("paste");
  const [pastedText, setPastedText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [bearerToken, setBearerToken] = useState("");
  const [preferScheme, setPreferScheme] = useState<"https" | "http">("https");
  const [requestedPort, setRequestedPort] = useState("");
  const [methods, setMethods] = useState("GET");
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const generateMutation = useGenerateApi2McpServer();

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        setFileContent(null);
        setFileName(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          setFileContent(result);
          setFileName(file.name);
        }
      };
      reader.onerror = () => {
        setError("Unable to read the selected file");
        setFileContent(null);
        setFileName(null);
      };
      reader.readAsText(file);
    },
    [],
  );

  const isSubmitting = generateMutation.isPending;
  const result = generateMutation.data;

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      if (!name.trim()) {
        setError("Name is required");
        return;
      }

      let inputPayload:
        | { type: "text" | "file"; content: string; filename?: string }
        | { type: "url"; url: string }
        | null = null;

      if (inputMode === "url") {
        if (!urlInput.trim()) {
          setError("Please provide a documentation URL");
          return;
        }
        inputPayload = { type: "url", url: urlInput.trim() };
      } else if (inputMode === "paste") {
        if (!pastedText.trim()) {
          setError("Paste the API spec or reference text first");
          return;
        }
        inputPayload = { type: "text", content: pastedText };
      } else if (inputMode === "upload") {
        if (!fileContent) {
          setError("Select a JSON or TXT file to upload");
          return;
        }
        inputPayload = {
          type: "file",
          content: fileContent,
          filename: fileName ?? "spec.txt",
        };
      }

      if (!inputPayload) {
        setError("Invalid input selection");
        return;
      }

      const filteredMethods = methods
        .split(",")
        .map((m) => m.trim().toUpperCase())
        .filter(Boolean);

      await generateMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        mode: "reference",
        input: inputPayload,
        baseUrl: baseUrl.trim() || undefined,
        bearerToken: bearerToken.trim() || undefined,
        preferScheme,
        methods: filteredMethods.length > 0 ? filteredMethods : undefined,
        requestedPort: requestedPort ? Number(requestedPort) : undefined,
      });
      setShowDetails(true);
    },
    [
      baseUrl,
      bearerToken,
      description,
      generateMutation,
      inputMode,
      methods,
      name,
      onGenerationComplete,
      pastedText,
      preferScheme,
      requestedPort,
      urlInput,
      fileContent,
      fileName,
    ],
  );

  const runtimeBadgeVariant = useMemo(() => {
    if (!result) return "secondary";
    switch (result.runtime.status) {
      case "running":
        return "default";
      case "error":
        return "destructive";
      default:
        return "secondary";
    }
  }, [result]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate from API (api2mcp)</CardTitle>
        <CardDescription>
          Provide an OpenAPI/Swagger spec or documentation snippet and Archestra
          will generate, run, and register an MCP server automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="api2mcp-name">Server name</Label>
              <Input
                id="api2mcp-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. My CRM API"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api2mcp-description">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="api2mcp-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short summary for your team"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Input source</Label>
            <RadioGroup
              value={inputMode}
              onValueChange={(value) => setInputMode(value as InputMode)}
              className="grid gap-3 md:grid-cols-3"
            >
              <Label
                htmlFor="input-paste"
                className={`border rounded-md p-3 cursor-pointer ${
                  inputMode === "paste" ? "border-primary" : "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="input-paste" value="paste" />
                  Paste spec / reference
                </div>
              </Label>
              <Label
                htmlFor="input-upload"
                className={`border rounded-md p-3 cursor-pointer ${
                  inputMode === "upload" ? "border-primary" : "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="input-upload" value="upload" />
                  Upload JSON/TXT
                </div>
              </Label>
              <Label
                htmlFor="input-url"
                className={`border rounded-md p-3 cursor-pointer ${
                  inputMode === "url" ? "border-primary" : "border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="input-url" value="url" />
                  Scrap documentation URL
                </div>
              </Label>
            </RadioGroup>
          </div>

          {inputMode === "paste" && (
            <div className="space-y-2">
              <Label htmlFor="api2mcp-paste">
                API specification or reference text
              </Label>
              <Textarea
                id="api2mcp-paste"
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                placeholder="Paste OpenAPI JSON/YAML or any reference text..."
                rows={8}
              />
            </div>
          )}

          {inputMode === "upload" && (
            <div className="space-y-2">
              <Label htmlFor="api2mcp-file">Specification file</Label>
              <div className="flex flex-col gap-2">
                <Input
                  id="api2mcp-file"
                  type="file"
                  accept=".json,.yaml,.yml,.txt"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <label
                  htmlFor="api2mcp-file"
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-muted-foreground/40 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted cursor-pointer transition-colors w-fit"
                >
                  <FilePlus className="h-4 w-4" />
                  Choose file
                </label>
              </div>
              {fileName && (
                <p className="text-xs text-muted-foreground">
                  Selected: {fileName}
                </p>
              )}
            </div>
          )}

          {inputMode === "url" && (
            <div className="space-y-2">
              <Label htmlFor="api2mcp-url">Documentation URL</Label>
              <Input
                id="api2mcp-url"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://developer.example.com/api"
              />
            </div>
          )}

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="api2mcp-baseurl">
                Base URL override <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="api2mcp-baseurl"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api2mcp-token">
                Bearer token <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="api2mcp-token"
                type="password"
                value={bearerToken}
                onChange={(event) => setBearerToken(event.target.value)}
                placeholder="sk-..."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Preferred scheme</Label>
              <RadioGroup
                value={preferScheme}
                onValueChange={(value) =>
                  setPreferScheme(value as "https" | "http")
                }
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="https" id="scheme-https" />
                  <Label htmlFor="scheme-https">HTTPS</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="http" id="scheme-http" />
                  <Label htmlFor="scheme-http">HTTP</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="api2mcp-port">
                Preferred port <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="api2mcp-port"
                type="number"
                min={1}
                max={65535}
                value={requestedPort}
                onChange={(event) => setRequestedPort(event.target.value)}
                placeholder="Leave blank for auto"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api2mcp-methods">
              Allowed HTTP methods (comma-separated)
            </Label>
            <Input
              id="api2mcp-methods"
              value={methods}
              onChange={(event) => setMethods(event.target.value)}
              placeholder="GET,POST"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Cannot start generation</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Generating..." : "Generate & run MCP server"}
            </Button>
            <p className="text-xs text-muted-foreground">
              The generated MCP server runs locally inside Archestra and is
              automatically registered in your private registry.
            </p>
          </div>
        </form>

        {result && showDetails && (
          <div className="mt-6 space-y-3">
            <Separator />
            <Alert>
              <AlertTitle>{result.catalogItem.name} is ready</AlertTitle>
              <AlertDescription className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={runtimeBadgeVariant}>
                    {result.runtime.status === "running"
                      ? `Running on port ${result.runtime.port}`
                      : `Status: ${result.runtime.status}`}
                  </Badge>
                  {result.runtime.statusPort && (
                    <Badge variant="outline">
                      Status endpoint :{result.runtime.statusPort}
                    </Badge>
                  )}
                </div>
                <p className="text-sm">
                  Assigned URL: {result.catalogItem.serverUrl}
                </p>
                {result.runtime.logs.length > 0 && (
                  <div className="bg-muted rounded-md p-3 max-h-48 overflow-y-auto text-xs font-mono space-y-1">
                    {result.runtime.logs.map((line, index) => (
                      <pre key={`${line}-${index}`}>{line}</pre>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDetails(false);
                  setName("");
                  setDescription("");
                  setPastedText("");
                  setUrlInput("");
                  setFileContent(null);
                  setFileName(null);
                  setBaseUrl("");
                  setBearerToken("");
                }}
              >
                Create another
              </Button>
              <Button onClick={onGenerationComplete}>Close</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
