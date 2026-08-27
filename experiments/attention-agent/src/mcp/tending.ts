import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { createApiClient, jsonToolResult, requiredEnv, vercelBypassHeaders } from "../lib/http";

const baseUrl = process.env.TENDING_BASE_URL?.trim() || "http://localhost:3000";
const api = createApiClient(baseUrl, requiredEnv("TENDING_API_KEY"), vercelBypassHeaders("TENDING_VERCEL_BYPASS_SECRET"));

type ApiResponse<T> = { success: true; data: T };
type ListPayload<T> = { data: T[] };

type Connection = {
  id: string;
  name?: string | null;
  type?: string | null;
  threadSummary?: string | null;
  contactDetails?: {
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    location?: string | null;
  } | null;
  [key: string]: unknown;
};

async function readList<T>(path: string) {
  const response = await api<ApiResponse<ListPayload<T>>>(path);
  return response.data.data;
}

function buildServer() {
  const server = new McpServer({ name: "tending", version: "0.1.0" });

  server.registerTool(
    "tending_search_connections",
    {
      description:
        "Search Tending relationships/connections. Use this first to resolve a person or organisation before reading their relationship context.",
      inputSchema: z.object({
        query: z.string().trim().default(""),
        limit: z.number().int().min(1).max(200).default(100),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, limit }) => {
      const connections = await readList<Connection>(`/api/v1/connections?limit=${limit}`);
      const needle = query.toLowerCase();
      const data = needle
        ? connections.filter((connection) =>
            [
              connection.name,
              connection.type,
              connection.threadSummary,
              connection.contactDetails?.email,
              connection.contactDetails?.phone,
              connection.contactDetails?.location,
            ]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle)),
          )
        : connections;
      return jsonToolResult({ data });
    },
  );

  server.registerTool(
    "tending_get_relationship_context",
    {
      description:
        "Read the durable Tending context for one resolved connection: its current relationship summary, linked Moments and relationship observations. Prefer this over scanning all recent Moments when preparing for or understanding a particular relationship.",
      inputSchema: z.object({
        connectionId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ connectionId, limit }) => {
      const response = await api<ApiResponse<Record<string, unknown>>>(
        `/api/v1/connections/${connectionId}/context?limit=${limit}`,
      );
      return jsonToolResult(response.data);
    },
  );

  server.registerTool(
    "tending_recent_moments",
    {
      description:
        "Read recent Tending Moments across the organisation: deliberately kept relationship events and reflections. Use these for broad recency scans, not as a substitute for relationship-specific context.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(30),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit }) => jsonToolResult({ data: await readList(`/api/v1/moments?limit=${limit}`) }),
  );

  server.registerTool(
    "tending_recent_observations",
    {
      description:
        "Read recent Tending observations across the organisation. Use them for broad attention scans; relationship-specific observations are returned by tending_get_relationship_context.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(30),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit }) =>
      jsonToolResult({ data: await readList(`/api/v1/observations?limit=${limit}`) }),
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
    async ({ content, connectionIds, eventDate }) => {
      const response = await api<ApiResponse<unknown>>("/api/v1/moments", {
        method: "POST",
        body: JSON.stringify({ content, connectionIds, ...(eventDate ? { eventDate } : {}) }),
      });
      return jsonToolResult(response.data);
    },
  );

  return server;
}

serveStdio(buildServer);
