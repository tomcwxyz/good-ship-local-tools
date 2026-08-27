import { createApiClient, jsonToolResult, requiredEnv, vercelBypassHeaders } from "../lib/http";
import type { AvailableTool, ToolHub } from "./hub";

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const str = (extra: Record<string, unknown> = {}) => ({ type: "string", ...extra });
const int = (extra: Record<string, unknown> = {}) => ({ type: "integer", ...extra });

const tools: AvailableTool[] = [
  { name: "tending_search_connections", description: "Search Tending relationships/connections. Use this first to resolve a person or organisation before reading their relationship context.", inputSchema: obj({ query: str(), limit: int({ minimum: 1, maximum: 200, default: 100 }) }), annotations: { readOnlyHint: true } },
  { name: "tending_create_connection", description: "Propose creating a new Tending relationship when the user has described a meaningful person or organisation that cannot be resolved to an existing connection. The application requires explicit user approval before this write executes. If approved, use the returned connection ID for any relationship Moment already warranted by the same user input.", inputSchema: obj({ name: str({ minLength: 1, maxLength: 200 }), type: { type: "string", enum: ["person", "organisation", "group", "community"] }, contactDetails: obj({ email: str({ maxLength: 320 }), phone: str({ maxLength: 50 }), website: str({ maxLength: 300 }), location: str({ maxLength: 200 }) }) }, ["name", "type"]), annotations: { readOnlyHint: false } },
  { name: "tending_get_relationship_context", description: "Read the durable Tending context for one resolved connection: its current relationship summary, linked Moments and relationship observations.", inputSchema: obj({ connectionId: str({ format: "uuid" }), limit: int({ minimum: 1, maximum: 100, default: 30 }) }, ["connectionId"]), annotations: { readOnlyHint: true } },
  { name: "tending_recent_moments", description: "Read recent Tending Moments across the organisation.", inputSchema: obj({ limit: int({ minimum: 1, maximum: 100, default: 30 }) }), annotations: { readOnlyHint: true } },
  { name: "tending_recent_observations", description: "Read recent Tending relationship observations across the organisation.", inputSchema: obj({ limit: int({ minimum: 1, maximum: 100, default: 30 }) }), annotations: { readOnlyHint: true } },
  { name: "tending_create_moment", description: "Create a durable Tending Moment only after the user explicitly chooses that relationship learning is worth keeping.", inputSchema: obj({ content: str({ minLength: 1, maxLength: 10000 }), connectionIds: { type: "array", items: str({ format: "uuid" }), default: [] }, eventDate: str({ format: "date-time" }) }, ["content"]), annotations: { readOnlyHint: false } },
  { name: "calendar_find_events", description: "Read a bounded window of the current user's connected calendar as minimised external context. Use for upcoming meetings, preparation, recent meeting context, or finding an event by person/title. Calendar events are evidence, not durable organisational memory.", inputSchema: obj({ from: str(), to: str(), query: str(), limit: int({ minimum: 1, maximum: 100, default: 30 }) }), annotations: { readOnlyHint: true } },
  { name: "swells_list_spaces", description: "List Swells spaces available to the user represented by the scoped API key.", inputSchema: obj({}), annotations: { readOnlyHint: true } },
  { name: "swells_recent_observations", description: "Read recent human observations from a Swells space as sensing evidence.", inputSchema: obj({ spaceId: str({ format: "uuid" }), limit: int({ minimum: 1, maximum: 100, default: 30 }) }), annotations: { readOnlyHint: true } },
  { name: "swells_signals", description: "Read current Swells signals: patterns assembled from observations.", inputSchema: obj({ spaceId: str({ format: "uuid" }), limit: int({ minimum: 1, maximum: 100, default: 30 }) }), annotations: { readOnlyHint: true } },
  { name: "swells_create_observation", description: "Propose a durable Swells Observation in an explicit Swells space when something seems worth noticing. Observations may be tentative or second-hand if provenance and uncertainty are preserved. The application requires explicit user approval before this write executes.", inputSchema: obj({ spaceId: str({ format: "uuid" }), text: str({ minLength: 1, maxLength: 5000 }) }, ["spaceId", "text"]), annotations: { readOnlyHint: false } },
  { name: "glade_list_decisions", description: "List decisions from Glade, the durable governance/decision record.", inputSchema: obj({ status: { type: "string", enum: ["decided", "implemented", "reviewed", "learned"] }, limit: int({ minimum: 1, maximum: 200, default: 50 }) }), annotations: { readOnlyHint: true } },
  { name: "glade_get_decision", description: "Read a Glade decision in detail by its decision number.", inputSchema: obj({ number: int({ minimum: 1 }) }, ["number"]), annotations: { readOnlyHint: true } },
  { name: "glade_list_open_actions", description: "List open Glade actions and commitments.", inputSchema: obj({ limit: int({ minimum: 1, maximum: 200, default: 50 }) }), annotations: { readOnlyHint: true } },
  { name: "glade_create_action", description: "Propose a private Glade action for a concrete commitment or next step. Use this for something specific that should happen, especially when there is an owner or due date. Preserve compact provenance metadata when the commitment directly arose from another record or ContextEvent. The application requires explicit user approval before this write executes.", inputSchema: obj({ description: str({ minLength: 1, maxLength: 2000 }), ownerName: str({ maxLength: 255 }), dueDate: str(), metadata: { type: "object", additionalProperties: true } }, ["description"]), annotations: { readOnlyHint: false } },
  { name: "glade_update_action", description: "Propose updating an existing Glade action, including owner, due date, description or status. Use only for a known existing commitment. The application requires explicit user approval before this write executes.", inputSchema: obj({ actionId: str({ format: "uuid" }), description: str({ minLength: 1, maxLength: 2000 }), ownerName: { anyOf: [str({ maxLength: 255 }), { type: "null" }] }, dueDate: { anyOf: [str(), { type: "null" }] }, status: { type: "string", enum: ["open", "in_progress", "complete", "overdue"] } }, ["actionId"]), annotations: { readOnlyHint: false } },
  { name: "glade_list_meetings", description: "List recent Glade governance meetings.", inputSchema: obj({ limit: int({ minimum: 1, maximum: 200, default: 30 }) }), annotations: { readOnlyHint: true } },
  { name: "glade_list_documents", description: "List Glade governance documents.", inputSchema: obj({ limit: int({ minimum: 1, maximum: 200, default: 30 }) }), annotations: { readOnlyHint: true } },
  { name: "glade_draft_decision_candidate", description: "Structure something that may deserve to become a Glade decision. This does not save anything.", inputSchema: obj({ title: str({ minLength: 1 }), proposedOutcome: str({ minLength: 1 }), whyItMayNeedDecision: str({ minLength: 1 }), evidence: { type: "array", items: str({ minLength: 1 }), default: [] }, suggestedReviewDate: str() }, ["title", "proposedOutcome", "whyItMayNeedDecision"]), annotations: { readOnlyHint: true } },
];

type Envelope<T> = { success: true; data: T };
type ListPayload<T> = { data: T[] };
const n = (value: unknown, fallback: number, max: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.trunc(parsed), max)) : fallback;
};
const s = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;

export class DirectToolHub implements ToolHub {
  private readonly tending = createApiClient(process.env.TENDING_BASE_URL?.trim() || "http://localhost:3000", requiredEnv("TENDING_API_KEY"), vercelBypassHeaders("TENDING_VERCEL_BYPASS_SECRET"));
  private readonly swells = createApiClient(process.env.SWELLS_BASE_URL?.trim() || "https://swells.app", requiredEnv("SWELLS_API_KEY"));
  private readonly glade = createApiClient(process.env.GLADE_BASE_URL?.trim() || "http://localhost:3002", requiredEnv("GLADE_API_KEY"), vercelBypassHeaders("GLADE_VERCEL_BYPASS_SECRET"));
  private readonly defaultSpace = s(process.env.SWELLS_SPACE_ID);

  async connect() { return this.listTools(); }
  listTools() { return tools.filter((tool) => !["glade_create_action", "glade_update_action"].includes(tool.name) || process.env.GLADE_ACTION_WRITES_ENABLED === "true").map((tool) => ({ ...tool })); }
  requiresApproval(name: string) { return name === "glade_draft_decision_candidate" || tools.find((tool) => tool.name === name)?.annotations?.readOnlyHint !== true; }
  private space(args: Record<string, unknown>) {
    const id = s(args.spaceId) || this.defaultSpace;
    if (!id) throw new Error("spaceId is required (or set SWELLS_SPACE_ID)");
    return id;
  }

  async callTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "tending_search_connections": {
        const response = await this.tending<Envelope<ListPayload<Record<string, unknown>>>>(`/api/v1/connections?limit=${n(args.limit, 100, 200)}`);
        const query = s(args.query)?.toLowerCase() || "";
        const rows = query ? response.data.data.filter((row) => {
          const contact = (row.contactDetails ?? {}) as Record<string, unknown>;
          return [row.name, row.type, row.threadSummary, contact.email, contact.phone, contact.location].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
        }) : response.data.data;
        return jsonToolResult({ data: rows });
      }
      case "tending_create_connection": {
        const nameValue = s(args.name);
        const typeValue = s(args.type);
        if (!nameValue) throw new Error("name is required");
        if (!typeValue || !["person", "organisation", "group", "community"].includes(typeValue)) throw new Error("valid type is required");
        const contactDetails = args.contactDetails && typeof args.contactDetails === "object"
          ? Object.fromEntries(Object.entries(args.contactDetails as Record<string, unknown>).filter(([, value]) => typeof value === "string" && value.trim()))
          : undefined;
        const response = await this.tending<Envelope<Record<string, unknown>>>("/api/v1/connections", {
          method: "POST",
          body: JSON.stringify({ name: nameValue, type: typeValue, ...(contactDetails && Object.keys(contactDetails).length ? { contactDetails } : {}) }),
        });
        return jsonToolResult(response.data);
      }
      case "tending_get_relationship_context": {
        const id = s(args.connectionId);
        if (!id) throw new Error("connectionId is required");
        const response = await this.tending<Envelope<Record<string, unknown>>>(`/api/v1/connections/${id}/context?limit=${n(args.limit, 30, 100)}`);
        return jsonToolResult(response.data);
      }
      case "tending_recent_moments": {
        const response = await this.tending<Envelope<ListPayload<unknown>>>(`/api/v1/moments?limit=${n(args.limit, 30, 100)}`);
        return jsonToolResult({ data: response.data.data });
      }
      case "tending_recent_observations": {
        const response = await this.tending<Envelope<ListPayload<unknown>>>(`/api/v1/observations?limit=${n(args.limit, 30, 100)}`);
        return jsonToolResult({ data: response.data.data });
      }
      case "tending_create_moment": {
        const content = s(args.content);
        if (!content) throw new Error("content is required");
        const connectionIds = Array.isArray(args.connectionIds) ? args.connectionIds.filter((value): value is string => typeof value === "string") : [];
        const eventDate = s(args.eventDate);
        const response = await this.tending<Envelope<unknown>>("/api/v1/moments", { method: "POST", body: JSON.stringify({ content, connectionIds, ...(eventDate ? { eventDate } : {}) }) });
        return jsonToolResult(response.data);
      }
      case "calendar_find_events": {
        const params = new URLSearchParams({ limit: String(n(args.limit, 30, 100)) });
        const from = s(args.from); if (from) params.set("from", from);
        const to = s(args.to); if (to) params.set("to", to);
        const query = s(args.query); if (query) params.set("query", query);
        const response = await this.tending<Envelope<Record<string, unknown>>>(`/api/v1/calendar/events?${params}`);
        return jsonToolResult(response.data);
      }
      case "swells_list_spaces": return jsonToolResult(await this.swells("/api/v1/spaces"));
      case "swells_recent_observations": return jsonToolResult(await this.swells(`/api/v1/observations?spaceId=${this.space(args)}&limit=${n(args.limit, 30, 100)}`));
      case "swells_signals": return jsonToolResult(await this.swells(`/api/v1/signals?spaceId=${this.space(args)}&limit=${n(args.limit, 30, 100)}`));
      case "swells_create_observation": {
        const text = s(args.text);
        const spaceId = s(args.spaceId);
        if (!text) throw new Error("text is required");
        if (!spaceId) throw new Error("spaceId is required for Swells writes");
        return jsonToolResult(await this.swells("/api/v1/observations", { method: "POST", body: JSON.stringify({ spaceId, text }) }));
      }
      case "glade_list_decisions": {
        const params = new URLSearchParams({ limit: String(n(args.limit, 50, 200)) });
        const status = s(args.status); if (status) params.set("status", status);
        return jsonToolResult(await this.glade(`/api/v1/decisions?${params}`));
      }
      case "glade_get_decision": return jsonToolResult(await this.glade(`/api/v1/decisions/${n(args.number, 1, Number.MAX_SAFE_INTEGER)}`));
      case "glade_list_open_actions": return jsonToolResult(await this.glade(`/api/v1/actions?status=open&limit=${n(args.limit, 50, 200)}`));
      case "glade_create_action": {
        const description = s(args.description);
        if (!description) throw new Error("description is required");
        const ownerName = s(args.ownerName);
        const dueDate = s(args.dueDate);
        const metadata = args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata)
          ? args.metadata as Record<string, unknown>
          : undefined;
        return jsonToolResult(await this.glade("/api/v1/actions", {
          method: "POST",
          body: JSON.stringify({ description, ...(ownerName ? { ownerName } : {}), ...(dueDate ? { dueDate } : {}), ...(metadata ? { metadata } : {}) }),
        }));
      }
      case "glade_update_action": {
        const actionId = s(args.actionId);
        if (!actionId) throw new Error("actionId is required");
        const updates: Record<string, unknown> = {};
        if (args.description !== undefined) updates.description = args.description;
        if (args.ownerName !== undefined) updates.ownerName = args.ownerName;
        if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
        if (args.status !== undefined) updates.status = args.status;
        return jsonToolResult(await this.glade(`/api/v1/actions/${actionId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        }));
      }
      case "glade_list_meetings": return jsonToolResult(await this.glade(`/api/v1/meetings?limit=${n(args.limit, 30, 200)}`));
      case "glade_list_documents": return jsonToolResult(await this.glade(`/api/v1/documents?limit=${n(args.limit, 30, 200)}`));
      case "glade_draft_decision_candidate": return jsonToolResult({ saved: false, kind: "glade_decision_candidate", candidate: args, nextStep: "Review with the user, then record through Glade if they explicitly decide to keep it." });
      default: throw new Error(`Unknown direct tool: ${name}`);
    }
  }
  async close() {}
}
