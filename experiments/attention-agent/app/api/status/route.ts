import { NextResponse } from "next/server";
import { cloudMode, isAuthorised } from "../../../src/web/cloud.js";

export const runtime = "nodejs";
const has = (...names: string[]) => names.every((name) => Boolean(process.env[name]?.trim()));

export async function GET(request: Request) {
  if (!isAuthorised(request)) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const mode = cloudMode();
  return NextResponse.json({
    mode,
    model: has("AGENT_MODEL"),
    state: has("AGENT_STATE_SECRET"),
    tending: mode === "remote-mcp" ? has("TENDING_MCP_URL") : has("TENDING_BASE_URL", "TENDING_API_KEY"),
    swells: mode === "remote-mcp" ? has("SWELLS_MCP_URL") : has("SWELLS_BASE_URL", "SWELLS_AGENT_API_TOKEN"),
    glade: mode === "remote-mcp" ? has("GLADE_MCP_URL") : has("GLADE_BASE_URL", "GLADE_API_KEY"),
  });
}
