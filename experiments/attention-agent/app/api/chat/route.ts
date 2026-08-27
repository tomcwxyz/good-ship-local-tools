import { NextResponse } from "next/server";
import { z } from "zod";
import { ApprovalRequiredError, AttentionAgent } from "../../../src/agent/model";
import type { ToolHub } from "../../../src/agent/hub";
import { cloudMode, createCloudHub, decryptState, encryptState, isAuthorised } from "../../../src/web/cloud";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  message: z.string().trim().min(1).max(12000).optional(),
  state: z.string().min(1).optional(),
  approval: z.object({ toolCallId: z.string().min(1), approved: z.boolean(), spaceId: z.string().uuid().optional() }).optional(),
});

type SpaceOption = { id: string; name: string; description?: string | null };

function spaceOptions(result: unknown): SpaceOption[] {
  const structured = result && typeof result === "object" ? (result as { structuredContent?: unknown }).structuredContent : undefined;
  const data = structured && typeof structured === "object" ? (structured as { data?: unknown }).data : undefined;
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    if (typeof value.id !== "string" || typeof value.name !== "string") return [];
    return [{ id: value.id, name: value.name, description: typeof value.description === "string" ? value.description : null }];
  });
}

async function approvalCopy(toolName: string, args: Record<string, unknown>, hub: ToolHub) {
  if (toolName === "tending_create_connection") {
    const type = typeof args.type === "string" ? args.type : "relationship";
    const contact = args.contactDetails && typeof args.contactDetails === "object"
      ? Object.values(args.contactDetails as Record<string, unknown>).filter((value) => typeof value === "string" && value.trim()).join(" · ")
      : "";
    return {
      product: "Tending",
      title: "Create this relationship?",
      detail: `${String(args.name ?? "")} · ${type}${contact ? `\n${contact}` : ""}`,
      approveLabel: "Create in Tending",
    };
  }
  if (toolName === "tending_create_moment") return { product: "Tending", title: "Keep this relationship moment?", detail: String(args.content ?? ""), approveLabel: "Keep in Tending" };
  if (toolName === "glade_draft_decision_candidate") {
    return {
      product: "Glade",
      title: "Review this decision candidate",
      detail: "This is a draft for discussion only. Nothing will be saved to Glade.",
      approveLabel: "Continue with draft",
      reviewOnly: true,
      decisionCandidate: {
        title: String(args.title ?? ""),
        proposedOutcome: String(args.proposedOutcome ?? ""),
        whyItMayNeedDecision: String(args.whyItMayNeedDecision ?? ""),
        evidence: Array.isArray(args.evidence) ? args.evidence.filter((value): value is string => typeof value === "string") : [],
        suggestedReviewDate: typeof args.suggestedReviewDate === "string" ? args.suggestedReviewDate : "",
      },
    };
  }
  if (toolName === "swells_create_observation") {
    let spaces: SpaceOption[] = [];
    try { spaces = spaceOptions(await hub.callTool("swells_list_spaces", {})); } catch {}
    return {
      product: "Swells",
      title: "Keep this observation?",
      detail: String(args.text ?? ""),
      approveLabel: "Keep in Swells",
      selectedSpaceId: typeof args.spaceId === "string" ? args.spaceId : undefined,
      spaceOptions: spaces,
    };
  }
  return { product: "Connected tool", title: `Allow ${toolName}?`, detail: JSON.stringify(args, null, 2), approveLabel: "Allow" };
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  let body: z.infer<typeof requestSchema>;
  try { body = requestSchema.parse(await request.json()); }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body.approval && !body.message) return NextResponse.json({ error: "message is required" }, { status: 400 });
  if (body.approval && !body.state) return NextResponse.json({ error: "state is required for approval" }, { status: 400 });

  const hub = createCloudHub();
  let agent: AttentionAgent | undefined;
  try {
    const snapshot = body.state ? decryptState(body.state) : undefined;
    await hub.connect();
    agent = new AttentionAgent(hub, async () => "defer", snapshot);
    const message = body.approval
      ? await agent.resumeApproval(
          body.approval.toolCallId,
          body.approval.approved,
          body.approval.spaceId ? { spaceId: body.approval.spaceId } : undefined,
        )
      : await agent.say(body.message!);
    return NextResponse.json({ type: "message", message, state: encryptState(agent.snapshot()), mode: cloudMode() });
  } catch (error) {
    if (error instanceof ApprovalRequiredError && agent) {
      return NextResponse.json({ type: "approval", pending: { toolCallId: error.toolCallId, toolName: error.toolName, args: error.args, ...await approvalCopy(error.toolName, error.args, hub) }, state: encryptState(agent.snapshot()), mode: cloudMode() });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  } finally {
    await hub.close();
  }
}
