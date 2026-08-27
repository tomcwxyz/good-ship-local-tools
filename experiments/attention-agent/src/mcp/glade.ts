import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { createApiClient, jsonToolResult, requiredEnv, vercelBypassHeaders } from "../lib/http";

const baseUrl = process.env.GLADE_BASE_URL?.trim() || "http://localhost:3002";
const api = createApiClient(baseUrl, requiredEnv("GLADE_API_KEY"), vercelBypassHeaders("GLADE_VERCEL_BYPASS_SECRET"));

function buildServer() {
  const server = new McpServer({ name: "glade", version: "0.1.0" });

  server.registerTool(
    "glade_list_decisions",
    {
      description:
        "List decisions from Glade, the durable governance/decision record. Use this when checking what has already been decided, what is live, or what may need review.",
      inputSchema: z.object({
        status: z.enum(["decided", "implemented", "reviewed", "learned"]).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ status, limit }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (status) params.set("status", status);
      return jsonToolResult(await api(`/api/v1/decisions?${params}`));
    },
  );

  server.registerTool(
    "glade_get_decision",
    {
      description:
        "Read a Glade decision in detail by its decision number, including its rationale and governance context where available.",
      inputSchema: z.object({ number: z.number().int().positive() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ number }) => jsonToolResult(await api(`/api/v1/decisions/${number}`)),
  );

  server.registerTool(
    "glade_list_open_actions",
    {
      description:
        "List open Glade actions and their parent decision, proposal or topic. Use this when checking commitments or what should happen next.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(50),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit }) => jsonToolResult(await api(`/api/v1/actions?status=open&limit=${limit}`)),
  );

  server.registerTool(
    "glade_create_action",
    {
      description:
        "Create a private Glade action only after the user explicitly approves it. Use this for a concrete commitment or next step, not vague advice or unresolved choices.",
      inputSchema: z.object({
        description: z.string().trim().min(1).max(2000),
        ownerName: z.string().trim().max(255).optional(),
        dueDate: z.string().trim().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ description, ownerName, dueDate }) =>
      jsonToolResult(await api("/api/v1/actions", {
        method: "POST",
        body: JSON.stringify({
          description,
          ...(ownerName ? { ownerName } : {}),
          ...(dueDate ? { dueDate } : {}),
        }),
      })),
  );

  server.registerTool(
    "glade_list_meetings",
    {
      description:
        "List recent Glade governance meetings. Use this to connect decisions and actions to the meetings where they were discussed.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(30),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit }) => jsonToolResult(await api(`/api/v1/meetings?limit=${limit}`)),
  );

  server.registerTool(
    "glade_list_documents",
    {
      description:
        "List Glade governance documents. Use this when a decision may affect an existing policy, plan or other governed document.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(30),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit }) => jsonToolResult(await api(`/api/v1/documents?limit=${limit}`)),
  );

  server.registerTool(
    "glade_draft_decision_candidate",
    {
      description:
        "Structure something that may deserve to become a Glade decision. This does NOT save anything to Glade; it creates a reviewable candidate because governance records should not be created automatically from ambient activity.",
      inputSchema: z.object({
        title: z.string().trim().min(1),
        proposedOutcome: z.string().trim().min(1),
        whyItMayNeedDecision: z.string().trim().min(1),
        evidence: z.array(z.string().trim().min(1)).default([]),
        suggestedReviewDate: z.string().optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (candidate) =>
      jsonToolResult({
        saved: false,
        kind: "glade_decision_candidate",
        candidate,
        nextStep: "Review with the user, then record through Glade if they explicitly decide to keep it.",
      }),
  );

  return server;
}

serveStdio(buildServer);
