import { optionalEnv, requiredEnv } from "../lib/http.js";
import type { McpToolHub } from "./mcp.js";

const MUTATING_TOOLS = new Set(["tending_create_moment", "swells_create_observation"]);

const SYSTEM_PROMPT = `You are an attention agent: one reasoning layer across several distinct tools and memories.

Your overriding job is to help the user notice what deserves attention, understand why it matters, remember selectively, decide deliberately, and act carefully.

The products have different meanings:
- Tending is durable relationship memory: who we are connected to and how those relationships are changing.
- Swells is collective sensing: observations, repeated patterns, tensions, opportunities and signals of change.
- Glade is governance memory: decisions, rationale, meetings, documents and commitments.

Rules:
1. Read across products when that improves understanding; do not force every query through every product.
2. External activity is evidence, not automatically a durable record.
3. Never turn a meeting/email/document into a Tending Moment or Swells Observation merely because it exists.
4. When something may deserve keeping, explain why and use the appropriate product only after the user confirms the write.
5. A Glade decision candidate is only a candidate; the pilot cannot persist Glade decisions and must not imply it has.
6. Keep product meanings distinct. Do not copy the same text into every system.
7. Prefer useful synthesis over long inventories. Say what deserves attention and why.
8. Be explicit about uncertainty and provenance.`;

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type AssistantMessage = {
  role: "assistant";
  content: string | null;
  tool_calls?: ToolCall[];
};

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | AssistantMessage
  | { role: "tool"; tool_call_id: string; content: string };

type ChatResponse = {
  choices?: Array<{ message?: AssistantMessage }>;
  error?: { message?: string };
};

export type ApprovalHandler = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<boolean>;

export class AttentionAgent {
  private readonly messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  private readonly baseUrl = (optionalEnv("AGENT_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
  private readonly model = requiredEnv("AGENT_MODEL");
  private readonly apiKey = optionalEnv("AGENT_API_KEY");

  constructor(
    private readonly hub: McpToolHub,
    private readonly approve: ApprovalHandler,
  ) {}

  async say(userText: string): Promise<string> {
    this.messages.push({ role: "user", content: userText });

    for (let round = 0; round < 10; round += 1) {
      const assistant = await this.complete();
      this.messages.push(assistant);

      const calls = assistant.tool_calls ?? [];
      if (calls.length === 0) return assistant.content?.trim() || "I don't have a useful response yet.";

      for (const call of calls) {
        let args: Record<string, unknown>;
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }

        if (MUTATING_TOOLS.has(call.function.name)) {
          const approved = await this.approve(call.function.name, args);
          if (!approved) {
            this.messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ ok: false, declinedByUser: true }),
            });
            continue;
          }
        }

        try {
          const result = await this.hub.callTool(call.function.name, args);
          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          });
        }
      }
    }

    throw new Error("Agent exceeded the maximum tool-call rounds for one turn");
  }

  private async complete(): Promise<AssistantMessage> {
    const tools = this.hub.listTools().map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description ?? "",
        parameters: tool.inputSchema,
      },
    }));

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.messages,
        tools,
        tool_choice: "auto",
        stream: false,
      }),
    });

    const raw = await response.text();
    let data: ChatResponse;
    try {
      data = JSON.parse(raw) as ChatResponse;
    } catch {
      throw new Error(`Model returned non-JSON response (${response.status}): ${raw.slice(0, 500)}`);
    }

    if (!response.ok) {
      throw new Error(data.error?.message || `Model request failed (${response.status})`);
    }

    const message = data.choices?.[0]?.message;
    if (!message) throw new Error("Model response did not include an assistant message");
    return message;
  }
}
