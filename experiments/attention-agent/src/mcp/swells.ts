import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { createApiClient, jsonToolResult, requiredEnv } from "../lib/http.js";

const baseUrl = process.env.SWELLS_BASE_URL?.trim() || "http://localhost:3001";
const api = createApiClient(baseUrl, requiredEnv("SWELLS_AGENT_API_TOKEN"));
const defaultSpaceId = process.env.SWELLS_SPACE_ID?.trim();

function resolvedSpaceId(spaceId?: string) {
  const value = spaceId || defaultSpaceId;
  if (!value) throw new Error("spaceId is required (or set SWELLS_SPACE_ID)");
  return value;
}

function buildServer() {
  const server = new McpServer({ name: "swells", version: "0.1.0" });

  server.registerTool(
    "swells_list_spaces",
    {
      description:
        "List Swells spaces available to the configured pilot user. Swells is the sensing layer: observations and signals describe what people are noticing and what may be changing.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => jsonToolResult(await api("/api/agent/spaces")),
  );

  server.registerTool(
    "swells_recent_observations",
    {
      description:
        "Read recent human observations from a Swells space. Use these as sensing evidence; do not present them as established facts merely because they were observed.",
      inputSchema: z.object({
        spaceId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ spaceId, limit }) => {
      const id = resolvedSpaceId(spaceId);
      return jsonToolResult(await api(`/api/agent/observations?spaceId=${id}&limit=${limit}`));
    },
  );

  server.registerTool(
    "swells_signals",
    {
      description:
        "Read current Swells signals: patterns assembled from observations. Use this when checking whether something from a meeting, relationship or decision connects to a wider change or repeated pattern.",
      inputSchema: z.object({
        spaceId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ spaceId, limit }) => {
      const id = resolvedSpaceId(spaceId);
      return jsonToolResult(await api(`/api/agent/signals?spaceId=${id}&limit=${limit}`));
    },
  );

  server.registerTool(
    "swells_create_observation",
    {
      description:
        "Create a durable Swells Observation only after the user explicitly chooses that a change, tension, opportunity or repeated pattern is worth noticing. This enters the normal Swells signal pipeline.",
      inputSchema: z.object({
        spaceId: z.string().uuid().optional(),
        text: z.string().trim().min(1).max(5000),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ spaceId, text }) =>
      jsonToolResult(
        await api("/api/agent/observations", {
          method: "POST",
          body: JSON.stringify({ spaceId: resolvedSpaceId(spaceId), text }),
        }),
      ),
  );

  return server;
}

serveStdio(buildServer);
