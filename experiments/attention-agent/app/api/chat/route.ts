import { NextResponse } from "next/server";
import { z } from "zod";
import { ApprovalRequiredError, AttentionAgent } from "../../../src/agent/model.js";
import { cloudMode, createCloudHub, decryptState, encryptState, isAuthorised } from "../../../src/web/cloud.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  message: z.string().trim().min(1).max(12000).optional(),
  state: z.string().min(1).optional(),
  approval: z.object({ toolCallId: z.string().min(1), approved: z.boolean() }).optional(),
});

function approvalCopy(toolName: string, args: Record<string, unknown>) {
  if (toolName === "tending_create_moment") return { product: "Tending", title: "Keep this relationship moment?", detail: String(args.content ?? ""), approveLabel: "Keep in Tending" };
  if (toolName === "swells_create_observation") return { product: "Swells", title: "Keep this observation?", detail: String(args.text ?? ""), approveLabel: "Keep in Swells" };
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
      ? await agent.resumeApproval(body.approval.toolCallId, body.approval.approved)
      : await agent.say(body.message!);
    return NextResponse.json({ type: "message", message, state: encryptState(agent.snapshot()), mode: cloudMode() });
  } catch (error) {
    if (error instanceof ApprovalRequiredError && agent) {
      return NextResponse.json({ type: "approval", pending: { toolCallId: error.toolCallId, toolName: error.toolName, args: error.args, ...approvalCopy(error.toolName, error.args) }, state: encryptState(agent.snapshot()), mode: cloudMode() });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  } finally {
    await hub.close();
  }
}
