import { NextResponse } from "next/server";
import { cloudMode, createCloudHub, isAuthorised } from "../../../src/web/cloud";

export const runtime = "nodejs";
export const maxDuration = 30;

const has = (...names: string[]) =>
  names.every((name) => Boolean(process.env[name]?.trim()));

function directConfigured() {
  return {
    tending: has("TENDING_BASE_URL", "TENDING_API_KEY"),
    swells: has("SWELLS_BASE_URL", "SWELLS_API_KEY"),
    glade: has("GLADE_BASE_URL", "GLADE_API_KEY"),
  };
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const mode = cloudMode();
  const configured = directConfigured();
  let tools: string[] = [];
  let connectionError: string | undefined;

  if (mode === "remote-mcp") {
    const hub = createCloudHub();
    try {
      tools = (await hub.connect()).map((tool) => tool.name);
    } catch (error) {
      connectionError = error instanceof Error ? error.message : String(error);
    } finally {
      await hub.close();
    }
  }

  const connected = (prefix: string, fallback: boolean) =>
    mode === "remote-mcp"
      ? tools.some((name) => name.startsWith(prefix))
      : fallback;

  return NextResponse.json({
    mode,
    model: has("AGENT_MODEL"),
    state: has("AGENT_STATE_SECRET"),
    tending: connected("tending_", configured.tending),
    swells: connected("swells_", configured.swells),
    glade: connected("glade_", configured.glade),
    calendar: mode === "remote-mcp"
      ? tools.includes("calendar_find_events")
      : configured.tending,
    ...(connectionError ? { connectionError } : {}),
  });
}
