import { archestraApiSdk, type archestraApiTypes } from "@archestra/shared";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

const {
  createInternalMcpCatalogItem,
  deleteInternalMcpCatalogItem,
  getInternalMcpCatalog,
  updateInternalMcpCatalogItem,
} = archestraApiSdk;

export function useInternalMcpCatalog(params?: {
  initialData?: archestraApiTypes.GetInternalMcpCatalogResponses["200"];
}) {
  return useSuspenseQuery({
    queryKey: ["mcp-catalog"],
    queryFn: async () => (await getInternalMcpCatalog()).data ?? [],
    initialData: params?.initialData,
  });
}

export function useCreateInternalMcpCatalogItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: archestraApiTypes.CreateInternalMcpCatalogItemData["body"],
    ) => {
      const response = await createInternalMcpCatalogItem({ body: data });
      return response.data;
    },
    onSuccess: (newItem) => {
      queryClient.setQueryData<
        archestraApiTypes.GetInternalMcpCatalogResponses["200"]
      >(["mcp-catalog"], (prev) =>
        newItem ? [...(prev ?? []), newItem] : prev ?? [],
      );
      queryClient.invalidateQueries({ queryKey: ["mcp-catalog"] });
      toast.success("Catalog item created successfully");
    },
    onError: (error) => {
      console.error("Create error:", error);
      toast.error("Failed to create catalog item");
    },
  });
}

export function useUpdateInternalMcpCatalogItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: archestraApiTypes.UpdateInternalMcpCatalogItemData["body"];
    }) => {
      const response = await updateInternalMcpCatalogItem({
        path: { id },
        body: data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-catalog"] });
      // Also invalidate MCP servers to refresh reinstallRequired flags
      queryClient.invalidateQueries({ queryKey: ["mcp-servers"] });
      toast.success("Catalog item updated successfully");
    },
    onError: (error) => {
      console.error("Edit error:", error);
      toast.error("Failed to update catalog item");
    },
  });
}

export function useDeleteInternalMcpCatalogItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await deleteInternalMcpCatalogItem({ path: { id } });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-catalog"] });
      toast.success("Catalog item deleted successfully");
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error("Failed to delete catalog item");
    },
  });
}

type GenerateApi2McpResponse = {
  catalogItem: archestraApiTypes.GetInternalMcpCatalogResponses["200"][number];
  server: archestraApiTypes.GetMcpServersResponses["200"][number];
  runtime: {
    port: number;
    statusPort?: number;
    status: string;
    logs: string[];
  };
};

export function useGenerateApi2McpServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: {
        name: string;
        description?: string;
        mode?: "spec" | "reference";
        input:
          | { type: "text" | "file"; content: string; filename?: string }
          | { type: "url"; url: string };
        baseUrl?: string;
        bearerToken?: string;
        preferScheme?: "https" | "http" | "ws" | "wss";
        methods?: string[];
        requestedPort?: number;
      },
    ) => {
      const response = await fetch("/api/internal_mcp_catalog/api2mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          (errorBody &&
            typeof errorBody === "object" &&
            "error" in errorBody &&
            typeof errorBody.error === "object" &&
            errorBody.error &&
            "message" in errorBody.error &&
            typeof errorBody.error.message === "string" &&
            errorBody.error.message) ||
          "Failed to generate MCP server";
        throw new Error(message);
      }
      return (await response.json()) as GenerateApi2McpResponse;
    },
    onSuccess: async (result) => {
      toast.success(
        `Generated ${result.catalogItem.name} on port ${result.runtime.port}`,
      );
      await queryClient.refetchQueries({ queryKey: ["mcp-catalog"] });
      await queryClient.refetchQueries({ queryKey: ["mcp-servers"] });
    },
    onError: (error) => {
      console.error("api2mcp generation error:", error);
      toast.error(error instanceof Error ? error.message : "Generation failed");
    },
  });
}
