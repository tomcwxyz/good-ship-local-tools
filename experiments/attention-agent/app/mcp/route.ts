import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { ApprovalRequiredError, AttentionAgent } from "../../src/agent/model";
import { createCloudHub, decryptState, encryptState, isAuthorised } from "../../src/web/cloud";

export const runtime = "nodejs";
export const maxDuration = 60;

type PendingVoiceApproval = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  prompt: string;
};

function approvalPrompt(toolName: string, args: Record<string, unknown>) {
  if (toolName === "tending_create_connection") {
    return `Create ${String(args.name ?? "this relationship")} in Tending?`;
  }
  if (toolName === "tending_create_moment") {
    return "Keep this as a relationship moment in Tending?";
  }
  if (toolName === "swells_create_observation") {
    return "Keep this observation in Swells?";
  }
  if (toolName === "glade_create_action") {
    const due = typeof args.dueDate === "string" && args.dueDate ? ` due ${args.dueDate}` : "";
    return `Create this action in Glade${due}?`;
  }
  if (toolName === "glade_draft_decision_candidate") {
    return `Review this decision candidate: ${String(args.title ?? "untitled decision")}?`;
  }
  return `Allow ${toolName}?`;
}

function pending(error: ApprovalRequiredError): PendingVoiceApproval {
  return {
    toolCallId: error.toolCallId,
    toolName: error.toolName,
    args: error.args,
    prompt: approvalPrompt(error.toolName, error.args),
  };
}

function toolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  };
}

async function runAttention(input: {
  message?: string;
  state?: string;
  approval?: {
    toolCallId: string;
    approved: boolean;
    spaceId?: string;
    ownerName?: string;
    dueDate?: string;
  };
}) {
  const hub = createCloudHub();
  let agent: AttentionAgent | undefined;
  try {
    await hub.connect();
    agent = new AttentionAgent(
      hub,
      async () => "defer",
      input.state ? decryptState(input.state) : undefined,
    );

    const message = input.approval
      ? await agent.resumeApproval(input.approval.toolCallId, input.approval.approved, {
          ...(input.approval.spaceId ? { spaceId: input.approval.spaceId } : {}),
          ...(input.approval.ownerName !== undefined ? { ownerName: input.approval.ownerName } : {}),
          ...(input.approval.dueDate !== undefined ? { dueDate: input.approval.dueDate } : {}),
        })
      : await agent.say(input.message!);

    return {
      type: "message" as const,
      message,
      state: encryptState(agent.snapshot()),
      trace: agent.trace(),
    };
  } catch (error) {
    if (error instanceof ApprovalRequiredError && agent) {
      return {
        type: "approval" as const,
        pending: pending(error),
        state: encryptState(agent.snapshot()),
        trace: agent.trace(),
      };
    }
    throw error;
  } finally {
    await hub.close();
  }
}

const mcp = createMcpHandler((server) => {
  server.registerTool(
    "attention_ask",
    {
      title: "Ask Attention",
      description:
        "Send a natural-language request to the Good Ship Attention agent. Use this as the primary interface rather than calling underlying organisational tools directly. If the result contains a pending approval, ask the human the supplied prompt and do not resolve it until they explicitly answer.",
      inputSchema: z.object({
        message: z.string().trim().min(1).max(12000),
        state: z.string().min(1).optional(),
      }),
    },
    async ({ message, state }) => toolResult(await runAttention({ message, state })),
  );

  server.registerTool(
    "attention_resolve_approval",
    {
      title: "Resolve Attention approval",
      description:
        "Continue an Attention request after the human explicitly approved or declined the pending action. confirmedByUser must only be true after a direct human yes/no response. The result may contain another approval, which must be confirmed separately.",
      inputSchema: z.object({
        state: z.string().min(1),
        toolCallId: z.string().min(1),
        approved: z.boolean(),
        confirmedByUser: z.literal(true),
        spaceId: z.string().uuid().optional(),
        ownerName: z.string().max(255).optional(),
        dueDate: z.string().optional(),
      }),
    },
    async ({ state, toolCallId, approved, spaceId, ownerName, dueDate }) =>
      toolResult(
        await runAttention({
          state,
          approval: {
            toolCallId,
            approved,
            ...(spaceId ? { spaceId } : {}),
            ...(ownerName !== undefined ? { ownerName } : {}),
            ...(dueDate !== undefined ? { dueDate } : {}),
          },
        }),
      ),
  );
}, {
  serverInfo: { name: "good-ship-attention", version: "0.3.0" },
});

async function handler(request: Request) {
  if (!isAuthorised(request)) {
    return new Response(JSON.stringify({ error: "Not authorised" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return mcp(request);
}

export { handler as GET, handler as POST };
