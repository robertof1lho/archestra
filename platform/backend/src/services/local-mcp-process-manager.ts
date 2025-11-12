import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import logger from "@/logging";
import { PYTHON_BIN } from "./api2mcp-runner";

export type LocalProcessStatus = "starting" | "running" | "stopped" | "error";

export interface StartLocalProcessOptions {
  serverId: string;
  scriptPath: string;
  env?: Record<string, string | undefined>;
  port: number;
  statusPort?: number;
}

export interface LocalProcessSummary {
  serverId: string;
  status: LocalProcessStatus;
  port: number;
  statusPort?: number;
  pid?: number;
  startedAt?: string;
  exitedAt?: string;
  logs: string[];
  error?: string;
}

interface ProcessInfo {
  child: ChildProcess;
  status: LocalProcessStatus;
  logs: string[];
  port: number;
  statusPort?: number;
  startedAt?: Date;
  exitedAt?: Date;
  error?: string;
}

const MAX_LOG_LINES = 200;

class LocalMcpProcessManager {
  private processes = new Map<string, ProcessInfo>();

  startProcess(options: StartLocalProcessOptions): LocalProcessSummary {
    const existing = this.processes.get(options.serverId);
    if (existing) {
      this.stopProcess(options.serverId).catch((error) => {
        logger.error(
          { err: error, serverId: options.serverId },
          "Failed to stop existing local MCP process before restart",
        );
      });
    }

    const scriptDir = path.dirname(options.scriptPath);
    const child = spawn(PYTHON_BIN, [options.scriptPath], {
      cwd: scriptDir,
      env: {
        ...process.env,
        ...(options.env || {}),
        API2MCP_PORT: String(options.port),
        ...(options.statusPort
          ? { API2MCP_STATUS_PORT: String(options.statusPort) }
          : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const info: ProcessInfo = {
      child,
      status: "starting",
      logs: [],
      port: options.port,
      statusPort: options.statusPort,
    };

    const appendLog = (prefix: string, chunk: Buffer) => {
      const text = chunk.toString().trimEnd();
      if (!text) return;
      info.logs.push(`${prefix} ${text}`);
      if (info.logs.length > MAX_LOG_LINES) {
        info.logs.splice(0, info.logs.length - MAX_LOG_LINES);
      }
      if (text.includes("[mcp]")) {
        info.status = "running";
        info.startedAt = info.startedAt ?? new Date();
      }
    };

    child.stdout?.on("data", (chunk) => appendLog("[stdout]", chunk));
    child.stderr?.on("data", (chunk) => appendLog("[stderr]", chunk));

    child.once("spawn", () => {
      info.status = "running";
      info.startedAt = new Date();
    });

    child.once("error", (error) => {
      info.status = "error";
      info.error = error.message;
      info.exitedAt = new Date();
      logger.error(
        { err: error, serverId: options.serverId },
        "Failed to start local MCP server process",
      );
    });

    child.once("close", (code) => {
      info.exitedAt = new Date();
      if (code === 0 && info.status !== "error") {
        info.status = "stopped";
      } else if (info.status !== "error") {
        info.status = "error";
        info.error = `Exited with code ${code}`;
      }
      this.processes.set(options.serverId, info);
    });

    this.processes.set(options.serverId, info);
    return this.toSummary(options.serverId);
  }

  getSummary(serverId: string): LocalProcessSummary | null {
    if (!this.processes.has(serverId)) {
      return null;
    }
    return this.toSummary(serverId);
  }

  async stopProcess(serverId: string): Promise<void> {
    const info = this.processes.get(serverId);
    if (!info) return;

    if (!info.child.killed) {
      info.child.kill();
    }
    info.status = "stopped";
    info.exitedAt = new Date();
    this.processes.set(serverId, info);
  }

  listSummaries(): LocalProcessSummary[] {
    return Array.from(this.processes.keys()).map((id) =>
      this.toSummary(id),
    );
  }

  private toSummary(serverId: string): LocalProcessSummary {
    const info = this.processes.get(serverId);
    if (!info) {
      return {
        serverId,
        status: "stopped",
        port: 0,
        logs: [],
      };
    }

    return {
      serverId,
      status: info.status,
      port: info.port,
      statusPort: info.statusPort,
      pid: info.child.pid ?? undefined,
      startedAt: info.startedAt?.toISOString(),
      exitedAt: info.exitedAt?.toISOString(),
      logs: [...info.logs],
      error: info.error,
    };
  }
}

export const localMcpProcessManager = new LocalMcpProcessManager();
