import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { createApiClient, jsonToolResult, requiredEnv } from "../lib/http.js";

const baseUrl = process.env.TENDING_BASE_URL?.trim() || "http://localhost:3000";
const api = createApiClient(baseUrl, requiredEnv("TENDING_API_KEY"));

type ListResponse<T> = { data: T[] };

type Connection = {
  id: string;
  name?: string | null;
  organisation?: string | null;
  role?: string | null;
  contactDetails?: { email?: string | null } | null;
  [key: string]: unknown;
};

function buildServer() {
  const server = new McpServer({ name: "tending", version: "0.1.0" });

  server.registerTool(
    "tending_search_connections",
    {
      description:
        "Search Tending relationships/connections. Use this when you need to understand who someone is, whether they are already known, or relationship context before acting.",
      inputSchema: z.object({
        query: z.string().trim().default(""),
        limit: z.number().int().min(1).max(200).default(100),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, limit }) => {
      const response = await api<ListResponse<Connection>>(`/api/v1/connections?limit=${limit}`);
      const needle = query.toLowerCase();
      const data = needle
        ? response.data.filter((connection) =>
            [
              connection.name,
              connection.organisation,
              connection.role,
              connection.contactDetails?.email,
            ]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle)),
          )
        : response.data;
      return jsonToolResult({ data });
    },
  );

  server.registerTool(
    "tending_recent_moments",
    {
      description:
        "Read recent Tending Moments: deliberately kept relationship events and reflections. Use these as durable relationship memory, not as a complete activity log.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(30),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit }) => jsonToolResult(await api(`/api/v1/moments?limit=${limit}`)),
  );

  server.registerTool(
    "tending_recent_observations",
    {
      description:
        "Read recent Tending observations about relationship context. Use them to supplement Moments when understanding a relationship.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(30),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit }) => jsonToolResult(await api(`/api/v1/observations?limit=${limit}`)),
  );

  server.registerTool(
    "tending_create_moment",
    {
      description:
        "Create a durable Tending Moment after the user has explicitly chosen that relationship learning is worth keeping. Never use this merely because an email, meeting or document exists.",
      inputSchema: z.object({
        content: z.string().trim().min(1).max(10000),
        connectionIds: z.array(z.string().uuid()).default([]),
        eventDate: z.string().datetime({ offset: true }).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ content, connectionIds, eventDate }) =>
      jsonToolResult(
        await api("/api/v1/moments", {
          method: "POST",
          body: JSON.stringify({ content, connectionIds, ...(eventDate ? { eventDate } : {}) }),
        }),
      ),
  );

  return server;
}

serveStdio(buildServer);
