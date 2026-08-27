import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { optionalEnv } from "../lib/http";
import type { AvailableTool, ToolHub } from "./hub";

type ProductConfig = {
  product: "tending" | "swells" | "glade";
  script: URL;
  remoteUrlEnv: string;
  remoteTokenEnv: string;
  baseUrlEnv: string;
  apiKeyEnv: string;
  defaultBaseUrl: string;
  bypassEnv?: string;
};

const configs: ProductConfig[] = [
  {
    product: "tending",
    script: new URL("../mcp/tending.ts", import.meta.url),
    remoteUrlEnv: "TENDING_MCP_URL",
    remoteTokenEnv: "TENDING_MCP_BEARER_TOKEN",
    baseUrlEnv: "TENDING_BASE_URL",
    apiKeyEnv: "TENDING_API_KEY",
    defaultBaseUrl: "http://localhost:3000",
    bypassEnv: "TENDING_VERCEL_BYPASS_SECRET",
  },
  {
    product: "swells",
    script: new URL("../mcp/swells.ts", import.meta.url),
    remoteUrlEnv: "SWELLS_MCP_URL",
    remoteTokenEnv: "SWELLS_MCP_BEARER_TOKEN",
    baseUrlEnv: "SWELLS_BASE_URL",
    apiKeyEnv: "SWELLS_API_KEY",
    defaultBaseUrl: "https://swells.app",
  },
  {
    product: "glade",
    script: new URL("../mcp/glade.ts", import.meta.url),
    remoteUrlEnv: "GLADE_MCP_URL",
    remoteTokenEnv: "GLADE_MCP_BEARER_TOKEN",
    baseUrlEnv: "GLADE_BASE_URL",
    apiKeyEnv: "GLADE_API_KEY",
    defaultBaseUrl: "https://ourglade.app",
    bypassEnv: "GLADE_VERCEL_BYPASS_SECRET",
  },
];

function inheritedEnv(): Record<string, string> {
  return Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

export class McpToolHub implements ToolHub {
  private clients: Client[] = [];
  private owners = new Map<string, Client>();
  private tools: AvailableTool[] = [];

  constructor(private readonly options: { allowStdio?: boolean; remoteDefaults?: boolean } = {}) {}

  async connect() {
    for (const config of configs) {
      const client = new Client(
        { name: `attention-agent-${config.product}`, version: "0.2.0" },
        { versionNegotiation: { mode: "auto" } },
      );
      const explicitRemoteUrl = optionalEnv(config.remoteUrlEnv);
      const baseUrl = optionalEnv(config.baseUrlEnv) || config.defaultBaseUrl;
      const remoteUrl = explicitRemoteUrl
        || (this.options.remoteDefaults ? `${baseUrl.replace(/\/$/, "")}/mcp` : undefined);
      if (remoteUrl) {
        const bearer = optionalEnv(config.remoteTokenEnv)
          || (this.options.remoteDefaults ? optionalEnv(config.apiKeyEnv) : undefined);
        const bypass = config.bypassEnv ? optionalEnv(config.bypassEnv) : undefined;
        const headers: Record<string, string> = {};
        if (bearer) headers.authorization = `Bearer ${bearer}`;
        if (bypass) headers["x-vercel-protection-bypass"] = bypass;
        await client.connect(new StreamableHTTPClientTransport(
          new URL(remoteUrl),
          Object.keys(headers).length ? { requestInit: { headers } } : undefined,
        ));
      } else {
        if (this.options.allowStdio === false) throw new Error(`${config.remoteUrlEnv} is required when stdio MCP is disabled`);
        await client.connect(new StdioClientTransport({
          command: process.platform === "win32" ? "npx.cmd" : "npx",
          args: ["tsx", fileURLToPath(config.script)],
          env: inheritedEnv(),
        }));
      }
      this.clients.push(client);
      const { tools } = await client.listTools();
      for (const tool of tools) {
        if (this.owners.has(tool.name)) throw new Error(`Duplicate MCP tool name: ${tool.name}`);
        this.owners.set(tool.name, client);
        this.tools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema as Record<string, unknown>,
          annotations: tool.annotations as { readOnlyHint?: boolean } | undefined,
        });
      }
    }
    return this.listTools();
  }

  listTools() { return [...this.tools]; }

  requiresApproval(name: string) {
    if (name === "glade_draft_decision_candidate") return true;
    const tool = this.tools.find((candidate) => candidate.name === name);
    return tool?.annotations?.readOnlyHint !== true;
  }

  async callTool(name: string, args: Record<string, unknown>) {
    const client = this.owners.get(name);
    if (!client) throw new Error(`Unknown MCP tool: ${name}`);
    return client.callTool({ name, arguments: args });
  }

  async close() {
    await Promise.allSettled(this.clients.map((client) => client.close()));
    this.clients = [];
    this.owners.clear();
    this.tools = [];
  }
}
