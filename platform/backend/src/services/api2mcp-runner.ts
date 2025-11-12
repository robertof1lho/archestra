import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  writeFile,
  mkdir,
  readFile,
  rm,
  cp,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import logger from "@/logging";

const SCRIPTS_ROOT = path.resolve(process.cwd(), "scripts/api2mcp");
const SCRIPT_PATH = path.join(SCRIPTS_ROOT, "api2mcp.py");
const SERVERS_ROOT = path.resolve(process.cwd(), "api2mcp_servers");
const VENV_ROOT = path.join(SCRIPTS_ROOT, ".venv");
const VENV_BIN = path.join(
  VENV_ROOT,
  process.platform === "win32" ? "Scripts" : "bin",
);
const VENV_PYTHON = path.join(
  VENV_BIN,
  process.platform === "win32" ? "python.exe" : "python",
);
const REQUIREMENTS_PATH = path.join(SCRIPTS_ROOT, "requirementes.txt");
const EXPLICIT_PYTHON_BIN =
  process.env.API2MCP_PYTHON_BIN ||
  process.env.PYTHON_BIN ||
  process.env.PYTHON ||
  null;
const PYTHON_BIN = EXPLICIT_PYTHON_BIN ?? VENV_PYTHON;

export type Api2McpInput =
  | {
      type: "text" | "file";
      content: string;
      filename?: string;
    }
  | {
      type: "url";
      url: string;
    };

export interface Api2McpGenerationOptions {
  input: Api2McpInput;
  mode?: "spec" | "reference";
  baseUrl?: string;
  bearerToken?: string;
  preferScheme?: "https" | "http" | "ws" | "wss";
  methods?: string[];
  verbose?: boolean;
}

export interface Api2McpGenerationResult {
  finalState: Record<string, unknown>;
  scriptPath: string;
  scriptId: string;
}

async function ensureDirectory(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

let pythonReady: Promise<string> | null = null;

async function resolvePythonBin(): Promise<string> {
  if (EXPLICIT_PYTHON_BIN) {
    return EXPLICIT_PYTHON_BIN;
  }
  if (!pythonReady) {
    pythonReady = (async () => {
      await ensureVirtualEnv();
      return PYTHON_BIN;
    })();
  }
  return pythonReady;
}

async function ensureVirtualEnv(): Promise<void> {
  if (await pathExists(VENV_PYTHON)) {
    return;
  }
  await bootstrapVirtualEnv();
}

async function bootstrapVirtualEnv(): Promise<void> {
  const bootstrapPython =
    process.env.API2MCP_BOOTSTRAP_PYTHON || "python3";
  const commands: Array<{ cmd: string; args: string[]; label: string }> = [
    {
      cmd: bootstrapPython,
      args: ["-m", "venv", VENV_ROOT],
      label: "api2mcp[venv]",
    },
    {
      cmd: VENV_PYTHON,
      args: ["-m", "pip", "install", "--upgrade", "pip"],
      label: "api2mcp[pip]",
    },
    {
      cmd: VENV_PYTHON,
      args: ["-m", "pip", "install", "-r", REQUIREMENTS_PATH],
      label: "api2mcp[deps]",
    },
  ];
  for (const step of commands) {
    await runLoggedCommand(step.cmd, step.args, {
      cwd: SCRIPTS_ROOT,
      env: process.env,
      label: step.label,
    });
  }
}

async function runLoggedCommand(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; label: string },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      logger.debug(`[${options.label}][stdout] ${text.trimEnd()}`);
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      logger.warn(`[${options.label}][stderr] ${text.trimEnd()}`);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const error = new Error(
          `${options.label} exited with code ${code}. Stdout: ${stdout}\nStderr: ${stderr}`,
        );
        reject(error);
      }
    });
  });
}

async function runPythonCommand(args: string[]): Promise<void> {
  const pythonBin = await resolvePythonBin();
  await runLoggedCommand(pythonBin, args, {
    cwd: SCRIPTS_ROOT,
    env: process.env,
    label: "api2mcp",
  });
}

export class Api2McpRunner {
  async generateServer(
    options: Api2McpGenerationOptions,
  ): Promise<Api2McpGenerationResult> {
    const tempDir = await mkdtemp(path.join(tmpdir(), "api2mcp-"));
    const outDir = path.join(tempDir, "generated");
    const statePath = path.join(tempDir, "state.json");
    let inputPath: string | undefined;

    try {
      await ensureDirectory(outDir);

      const args = [SCRIPT_PATH, "convert"];

      if (options.input.type === "url") {
        args.push("--url", options.input.url);
      } else {
        inputPath = path.join(
          tempDir,
          options.input.filename || "input.txt",
        );
        await writeFile(inputPath, options.input.content, "utf-8");
        args.push("--in", inputPath);
      }

      args.push("--mode", options.mode ?? "reference");
      args.push("--out", outDir);
      args.push("--json-output", statePath);

      if (options.methods && options.methods.length > 0) {
        args.push("--methods", ...options.methods);
      }
      if (options.baseUrl) {
        args.push("--base-url", options.baseUrl);
      }
      if (options.bearerToken) {
        args.push("--bearer", options.bearerToken);
      }
      if (options.preferScheme) {
        args.push("--prefer-scheme", options.preferScheme);
      }
      if (options.verbose) {
        args.push("--verbose");
      }

      await runPythonCommand(args);

      const finalStateRaw = await readFile(statePath, "utf-8");
      const finalState = JSON.parse(finalStateRaw) as Record<string, unknown>;
      const generatedPath = finalState["generated_server_path"];

      if (typeof generatedPath !== "string") {
        throw new Error(
          "api2mcp did not return generated_server_path in final state",
        );
      }

      await ensureDirectory(SERVERS_ROOT);
      const scriptId = randomUUID();
      const destinationDir = path.join(SERVERS_ROOT, scriptId);
      await cp(outDir, destinationDir, { recursive: true });
      const scriptPath = path.join(
        destinationDir,
        path.basename(generatedPath),
      );

      return {
        finalState,
        scriptPath,
        scriptId,
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

export const api2mcpRunner = new Api2McpRunner();
export { PYTHON_BIN, SCRIPTS_ROOT, SERVERS_ROOT };
