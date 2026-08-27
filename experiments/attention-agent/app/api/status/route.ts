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

function toolError(result: unknown) {
  if (!result || typeof result !== "object") return undefined;
  const value = result as { isError?: unknown; content?: unknown };
  if (value.isError !== true) return undefined;
  if (Array.isArray(value.content)) {
    const first = value.content.find((item) =>
      item && typeof item === "object" && "text" in item,
    ) as { text?: unknown } | undefined;
    if (typeof first?.text === "string") return first.text;
  }
  return "MCP tool returned an error";
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const mode = cloudMode();
  const configured = directConfigured();

  if (mode === "direct-api") {
    return NextResponse.json({
      mode,
      model: has("AGENT_MODEL"),
      state: has("AGENT_STATE_SECRET"),
      ...configured,
      calendar: configured.tending,
    });
  }

  const hub = createCloudHub();
  let tools: string[] = [];
  const errors: string[] = [];
  const healthy = { tending: false, swells: false, glade: false };

  try {
    tools = (await hub.connect()).map((tool) => tool.name);

    for (const check of [
      { product: "tending" as const, tool: "tending_recent_moments", args: { limit: 1 } },
      { product: "swells" as const, tool: "swells_list_spaces", args: {} },
      { product: "glade" as const, tool: "glade_list_open_actions", args: { limit: 1 } },
    ]) {
      if (!tools.includes(check.tool)) {
        errors.push(`${check.product}: ${check.tool} is not exposed`);
        continue;
      }
      try {
        const result = await hub.callTool(check.tool, check.args);
        const error = toolError(result);
        if (error) throw new Error(error);
        healthy[check.product] = true;
      } catch (error) {
        errors.push(
          `${check.product}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    await hub.close();
  }

  return NextResponse.json({
    mode,
    model: has("AGENT_MODEL"),
    state: has("AGENT_STATE_SECRET"),
    tending: healthy.tending,
    swells: healthy.swells,
    glade: healthy.glade,
    calendar: healthy.tending && tools.includes("calendar_find_events"),
    ...(errors.length ? { connectionError: errors.join(" · ") } : {}),
  });
}
