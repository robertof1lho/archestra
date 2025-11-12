import logger from "@/logging";
import InternalMcpCatalogModel from "@/models/internal-mcp-catalog";
import McpServerModel from "@/models/mcp-server";
import ToolModel from "@/models/tool";
import type { InternalMcpCatalog, McpServer } from "@/types";
import { api2mcpRunner } from "./api2mcp-runner";
import { localMcpProcessManager } from "./local-mcp-process-manager";
import { findAvailablePort } from "./port-utils";

export interface GenerateApi2McpRequest {
  name: string;
  description?: string;
  mode?: "spec" | "reference";
  input:
    | {
        type: "text" | "file";
        content: string;
        filename?: string;
      }
    | { type: "url"; url: string };
  baseUrl?: string;
  bearerToken?: string;
  preferScheme?: "https" | "http" | "ws" | "wss";
  methods?: string[];
  requestedPort?: number;
  userId: string;
  isAdmin: boolean;
}

export interface GenerateApi2McpResponse {
  catalogItem: InternalMcpCatalog;
  server: McpServer;
  runtime: {
    port: number;
    statusPort?: number;
    status: string;
    logs: string[];
  };
}

const TOOL_DISCOVERY_MAX_ATTEMPTS = 5;
const TOOL_DISCOVERY_INITIAL_DELAY_MS = 2000;
const TOOL_DISCOVERY_RETRY_DELAY_MS = 2000;

export class Api2McpService {
  async generateAndRegister(
    payload: GenerateApi2McpRequest,
  ): Promise<GenerateApi2McpResponse> {
    if (!payload.isAdmin) {
      throw new Error("Only admins can generate MCP servers via api2mcp");
    }

    const generation = await api2mcpRunner.generateServer({
      input: payload.input,
      mode: payload.mode,
      baseUrl: payload.baseUrl,
      bearerToken: payload.bearerToken,
      preferScheme: payload.preferScheme,
      methods: payload.methods,
    });

    const desiredPort =
      payload.requestedPort && payload.requestedPort > 0
        ? payload.requestedPort
        : undefined;
    const port = await findAvailablePort(desiredPort);
    const statusPort = await findAvailablePort(port + 1);
    const serverUrl = `http://127.0.0.1:${port}/mcp`;

    const catalogItem = await InternalMcpCatalogModel.create({
      name: payload.name,
      description:
        payload.description ||
        `Generated via api2mcp on ${new Date().toISOString()}`,
      serverType: "remote",
      serverUrl,
      docsUrl: payload.input.type === "url" ? payload.input.url : undefined,
      requiresAuth: false,
      authFields: [],
      userConfig: {},
    });

    let serverRecord: McpServer | null = null;
    let runtimeSummary:
      | ReturnType<typeof localMcpProcessManager.startProcess>
      | null = null;

    try {
      serverRecord = await McpServerModel.create({
        name: payload.name,
        catalogId: catalogItem.id,
        ownerId: payload.userId,
        authType: "personal",
        userId: payload.userId,
        reinstallRequired: false,
        localInstallationStatus: "pending",
      });

      const runtimeEnv: Record<string, string | undefined> = {};
      if (payload.baseUrl) {
        runtimeEnv.OPENAPI_BASE_URL = payload.baseUrl;
      }
      if (payload.bearerToken) {
        runtimeEnv.OPENAPI_BEARER_TOKEN = payload.bearerToken;
      }

      runtimeSummary = localMcpProcessManager.startProcess({
        serverId: serverRecord.id,
        scriptPath: generation.scriptPath,
        port,
        statusPort,
        env: runtimeEnv,
      });

      const initialStatus =
        runtimeSummary.status === "error" || runtimeSummary.status === "stopped"
          ? "error"
          : "discovering-tools";
      const initialServerUpdate = await McpServerModel.update(
        serverRecord.id,
        {
          localInstallationStatus: initialStatus,
          localInstallationError: runtimeSummary.error ?? null,
        },
      );
      serverRecord = initialServerUpdate ?? serverRecord;

      if (initialStatus === "error" || !serverRecord) {
        throw new Error(
          runtimeSummary.error ??
            "Failed to start generated MCP server process",
        );
      }

      await this.fetchAndPersistToolsWithRetry(serverRecord.id);

      const finalizedServer =
        (await McpServerModel.update(serverRecord.id, {
          localInstallationStatus: "success",
          localInstallationError: null,
        })) ?? serverRecord;
      serverRecord = finalizedServer;

      return {
        catalogItem,
        server: serverRecord,
        runtime: {
          port,
          statusPort,
          status: runtimeSummary.status,
          logs: runtimeSummary.logs,
        },
      };
    } catch (error) {
      if (serverRecord) {
        await this.cleanupFailedGeneration(serverRecord.id, catalogItem.id);
      } else {
        await InternalMcpCatalogModel.delete(catalogItem.id);
      }
      throw error;
    }
  }

  private async fetchAndPersistToolsWithRetry(
    serverId: string,
  ): Promise<void> {
    await delay(TOOL_DISCOVERY_INITIAL_DELAY_MS);

    let lastError: unknown;
    for (let attempt = 1; attempt <= TOOL_DISCOVERY_MAX_ATTEMPTS; attempt++) {
      try {
        const server = await McpServerModel.findById(serverId);
        if (!server) {
          throw new Error(
            "MCP server not found while discovering generated tools",
          );
        }

        const tools = await McpServerModel.getToolsFromServer(server);
        if (tools.length === 0) {
          throw new Error("Generated MCP server reported no tools");
        }

        for (const tool of tools) {
          await ToolModel.create({
            name: ToolModel.slugifyName(server.name, tool.name),
            description: tool.description,
            parameters: tool.inputSchema,
            mcpServerId: server.id,
          });
        }

        return;
      } catch (error) {
        lastError = error;
        if (attempt < TOOL_DISCOVERY_MAX_ATTEMPTS) {
          await delay(TOOL_DISCOVERY_RETRY_DELAY_MS * attempt);
        }
      }
    }

    const reason =
      lastError instanceof Error ? lastError.message : "Unknown error";
    throw new Error(
      `Failed to fetch tools from generated MCP server: ${reason}`,
    );
  }

  private async cleanupFailedGeneration(
    serverId: string,
    catalogId: string,
  ): Promise<void> {
    try {
      await localMcpProcessManager.stopProcess(serverId);
    } catch (processError) {
      logger.warn(
        { err: processError, serverId },
        "Failed to stop MCP process during cleanup",
      );
    }

    try {
      await InternalMcpCatalogModel.delete(catalogId);
    } catch (catalogError) {
      logger.error(
        { err: catalogError, catalogId },
        "Failed to delete catalog entry during cleanup",
      );
    }
  }
}

export const api2mcpService = new Api2McpService();

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
