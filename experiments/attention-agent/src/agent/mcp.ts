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
};

const configs: ProductConfig[] = [
  { product: "tending", script: new URL("../mcp/tending.ts", import.meta.url), remoteUrlEnv: "TENDING_MCP_URL", remoteTokenEnv: "TENDING_MCP_BEARER_TOKEN" },
  { product: "swells", script: new URL("../mcp/swells.ts", import.meta.url), remoteUrlEnv: "SWELLS_MCP_URL", remoteTokenEnv: "SWELLS_MCP_BEARER_TOKEN" },
  { product: "glade", script: new URL("../mcp/glade.ts", import.meta.url), remoteUrlEnv: "GLADE_MCP_URL", remoteTokenEnv: "GLADE_MCP_BEARER_TOKEN" },
];

function inheritedEnv(): Record<string, string> {
  return Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

export class McpToolHub implements ToolHub {
  private clients: Client[] = [];
  private owners = new Map<string, Client>();
  private tools: AvailableTool[] = [];

  constructor(private readonly options: { allowStdio?: boolean } = {}) {}

  async connect() {
    for (const config of configs) {
      const client = new Client(
        { name: `attention-agent-${config.product}`, version: "0.2.0" },
        { versionNegotiation: { mode: "auto" } },
      );
      const remoteUrl = optionalEnv(config.remoteUrlEnv);
      if (remoteUrl) {
        const bearer = optionalEnv(config.remoteTokenEnv);
        await client.connect(new StreamableHTTPClientTransport(
          new URL(remoteUrl),
          bearer ? { requestInit: { headers: { authorization: `Bearer ${bearer}` } } } : undefined,
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
