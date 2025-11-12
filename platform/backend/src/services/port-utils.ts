import { createServer } from "node:net";

async function tryListen(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      server.close();
      reject(error);
    });
    server.listen({ port, host: "127.0.0.1" }, () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address) {
          resolve(address.port);
        } else {
          resolve(port);
        }
      });
    });
  });
}

export async function findAvailablePort(
  preferred?: number,
  maxAttempts = 10,
): Promise<number> {
  if (preferred !== undefined) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const portToTry = preferred + attempt;
      try {
        return await tryListen(portToTry);
      } catch (error: unknown) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== "EADDRINUSE") {
          throw error;
        }
      }
    }
  }

  // Fallback to asking OS for a random available port
  return tryListen(0);
}
