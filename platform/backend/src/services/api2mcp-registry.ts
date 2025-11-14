import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import logger from "@/logging";
import { SERVERS_ROOT } from "./api2mcp-runner";

export interface Api2McpRegistryEntry {
  serverId: string;
  scriptPath: string;
  port?: number;
  statusPort?: number;
  env?: Record<string, string | undefined>;
  finalState?: Record<string, unknown>;
  scriptId?: string;
  createdAt: string;
  updatedAt: string;
}

type RegistryMap = Record<string, Api2McpRegistryEntry>;

function isRecord(
  value: unknown,
): value is Record<string, Api2McpRegistryEntry> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

class Api2McpRegistry {
  private readonly registryPath = path.join(SERVERS_ROOT, "registry.json");

  private async readRegistry(): Promise<RegistryMap> {
    try {
      const raw = await readFile(this.registryPath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (isRecord(parsed)) {
        return parsed;
      }
      logger.warn(
        {
          registryPath: this.registryPath,
        },
        "api2mcp registry file was malformed; resetting",
      );
      return {};
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        logger.warn(
          { err, registryPath: this.registryPath },
          "Failed to read api2mcp registry; continuing with empty set",
        );
      }
      return {};
    }
  }

  private async writeRegistry(data: RegistryMap): Promise<void> {
    await mkdir(SERVERS_ROOT, { recursive: true });
    await writeFile(
      this.registryPath,
      JSON.stringify(data, null, 2),
      "utf-8",
    );
  }

  async listEntries(): Promise<Api2McpRegistryEntry[]> {
    const registry = await this.readRegistry();
    return Object.values(registry);
  }

  async getEntry(serverId: string): Promise<Api2McpRegistryEntry | null> {
    const registry = await this.readRegistry();
    return registry[serverId] ?? null;
  }

  async upsertEntry(
    entry: Omit<Api2McpRegistryEntry, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    },
  ): Promise<Api2McpRegistryEntry> {
    const registry = await this.readRegistry();
    const timestamp = new Date().toISOString();
    const existing = registry[entry.serverId];

    const nextEntry: Api2McpRegistryEntry = {
      ...existing,
      ...entry,
      createdAt: existing?.createdAt ?? entry.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    registry[entry.serverId] = nextEntry;
    await this.writeRegistry(registry);
    return nextEntry;
  }

  async deleteEntry(serverId: string): Promise<void> {
    const registry = await this.readRegistry();
    if (!registry[serverId]) {
      return;
    }
    delete registry[serverId];
    await this.writeRegistry(registry);
  }
}

export const api2mcpRegistry = new Api2McpRegistry();
