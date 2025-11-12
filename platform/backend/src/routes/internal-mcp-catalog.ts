import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { isEqual, omitBy } from "lodash-es";
import { z } from "zod";
import { InternalMcpCatalogModel, McpServerModel } from "@/models";
import { api2mcpService } from "@/services/api2mcp-service";
import {
  ErrorResponseSchema,
  InsertInternalMcpCatalogSchema,
  RouteId,
  SelectInternalMcpCatalogSchema,
  SelectMcpServerSchema,
  UpdateInternalMcpCatalogSchema,
  UuidIdSchema,
} from "@/types";
import { getUserFromRequest } from "@/utils";

const Api2McpInputSchema = z.union([
  z.object({
    type: z.enum(["text", "file"]),
    content: z.string().min(1, "Content is required"),
    filename: z.string().optional(),
  }),
  z.object({
    type: z.literal("url"),
    url: z.string().url(),
  }),
]);

const Api2McpGenerationRequestSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  mode: z.enum(["spec", "reference"]).optional(),
  input: Api2McpInputSchema,
  baseUrl: z.string().url().optional(),
  bearerToken: z.string().optional(),
  preferScheme: z.enum(["https", "http", "ws", "wss"]).optional(),
  methods: z.array(z.string()).optional(),
  requestedPort: z.number().int().min(1).max(65535).optional(),
});
type Api2McpGenerationRequest = z.infer<
  typeof Api2McpGenerationRequestSchema
>;

const Api2McpGenerationResponseSchema = z.object({
  catalogItem: SelectInternalMcpCatalogSchema,
  server: SelectMcpServerSchema,
  runtime: z.object({
    port: z.number(),
    statusPort: z.number().optional(),
    status: z.string(),
    logs: z.array(z.string()),
  }),
});

const internalMcpCatalogRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/api/internal_mcp_catalog",
    {
      schema: {
        operationId: RouteId.GetInternalMcpCatalog,
        description: "Get all Internal MCP catalog items",
        tags: ["MCP Catalog"],
        response: {
          200: z.array(SelectInternalMcpCatalogSchema),
          500: ErrorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        return reply.send(await InternalMcpCatalogModel.findAll());
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  fastify.post(
    "/api/internal_mcp_catalog",
    {
      schema: {
        operationId: RouteId.CreateInternalMcpCatalogItem,
        description: "Create a new Internal MCP catalog item",
        tags: ["MCP Catalog"],
        body: InsertInternalMcpCatalogSchema.omit({
          id: true,
          createdAt: true,
          updatedAt: true,
        }),
        response: {
          200: SelectInternalMcpCatalogSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return reply.send(await InternalMcpCatalogModel.create(request.body));
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  fastify.get(
    "/api/internal_mcp_catalog/:id",
    {
      schema: {
        operationId: RouteId.GetInternalMcpCatalogItem,
        description: "Get Internal MCP catalog item by ID",
        tags: ["MCP Catalog"],
        params: z.object({
          id: UuidIdSchema,
        }),
        response: {
          200: SelectInternalMcpCatalogSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const catalogItem = await InternalMcpCatalogModel.findById(
          request.params.id,
        );

        if (!catalogItem) {
          return reply.status(404).send({
            error: {
              message: "Catalog item not found",
              type: "not_found",
            },
          });
        }

        return reply.send(catalogItem);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  fastify.put(
    "/api/internal_mcp_catalog/:id",
    {
      schema: {
        operationId: RouteId.UpdateInternalMcpCatalogItem,
        description: "Update an Internal MCP catalog item",
        tags: ["MCP Catalog"],
        params: z.object({
          id: UuidIdSchema,
        }),
        body: UpdateInternalMcpCatalogSchema.omit({
          id: true,
          createdAt: true,
          updatedAt: true,
        }).partial(),
        response: {
          200: SelectInternalMcpCatalogSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        // Get the original catalog item to check if name or serverUrl changed
        const originalCatalogItem = await InternalMcpCatalogModel.findById(
          request.params.id,
        );

        if (!originalCatalogItem) {
          return reply.status(404).send({
            error: {
              message: "Catalog item not found",
              type: "not_found",
            },
          });
        }

        // Update the catalog item
        const catalogItem = await InternalMcpCatalogModel.update(
          request.params.id,
          request.body,
        );

        if (!catalogItem) {
          return reply.status(404).send({
            error: {
              message: "Catalog item not found",
              type: "not_found",
            },
          });
        }

        // Check if name, serverUrl, or authentication changed
        const nameChanged =
          "name" in request.body &&
          request.body.name !== originalCatalogItem.name;
        const urlChanged =
          "serverUrl" in request.body &&
          request.body.serverUrl !== originalCatalogItem.serverUrl;

        // For OAuth config, use lodash to normalize and compare
        // Remove falsy values (null, undefined, empty strings) before comparison
        const normalizeOAuthConfig = (config: unknown) => {
          if (!config || typeof config !== "object") return null;
          return omitBy(
            config as Record<string, unknown>,
            (value, key) =>
              value === null ||
              value === undefined ||
              value === "" ||
              ["name", "description"].includes(key),
          );
        };

        const oauthConfigChanged =
          "oauthConfig" in request.body &&
          !isEqual(
            normalizeOAuthConfig(request.body.oauthConfig),
            normalizeOAuthConfig(originalCatalogItem.oauthConfig),
          );

        // If critical fields changed, mark all installed servers for reinstall
        if (nameChanged || urlChanged || oauthConfigChanged) {
          const installedServers = await McpServerModel.findByCatalogId(
            request.params.id,
          );

          for (const server of installedServers) {
            await McpServerModel.update(server.id, {
              reinstallRequired: true,
            });
          }
        }

        return reply.send(catalogItem);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );

  fastify.post(
    "/api/internal_mcp_catalog/api2mcp",
    {
      schema: {
        operationId: RouteId.GenerateApi2McpServer,
        description: "Generate, run, and register an MCP server via api2mcp",
        tags: ["MCP Catalog"],
        body: Api2McpGenerationRequestSchema,
        response: {
          200: Api2McpGenerationResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const user = await getUserFromRequest(request);
        if (!user) {
          return reply.status(401).send({
            error: {
              message: "Unauthorized",
              type: "unauthorized",
            },
          });
        }

        const body = request.body as Api2McpGenerationRequest;
        const result = await api2mcpService.generateAndRegister({
          ...body,
          userId: user.id,
          isAdmin: user.isAdmin,
        });
        return reply.send(result);
      } catch (error) {
        fastify.log.error(error);
        const message =
          error instanceof Error ? error.message : "Internal server error";
        if (message.includes("Only admins")) {
          return reply.status(403).send({
            error: {
              message,
              type: "forbidden",
            },
          });
        }
        return reply.status(500).send({
          error: {
            message,
            type: "api_error",
          },
        });
      }
    },
  );

  fastify.delete(
    "/api/internal_mcp_catalog/:id",
    {
      schema: {
        operationId: RouteId.DeleteInternalMcpCatalogItem,
        description: "Delete an Internal MCP catalog item",
        tags: ["MCP Catalog"],
        params: z.object({
          id: UuidIdSchema,
        }),
        response: {
          200: z.object({ success: z.boolean() }),
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        return reply.send({
          success: await InternalMcpCatalogModel.delete(request.params.id),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: {
            message:
              error instanceof Error ? error.message : "Internal server error",
            type: "api_error",
          },
        });
      }
    },
  );
};

export default internalMcpCatalogRoutes;
