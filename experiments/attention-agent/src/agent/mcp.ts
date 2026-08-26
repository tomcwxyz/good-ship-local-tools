import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { optionalEnv } from "../lib/http.js";

export type AvailableTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
};

type ProductConfig = {
  product: "tending" | "swells" | "glade";
  script: URL;
  remoteUrlEnv: string;
  remoteTokenEnv: string;
};

const configs: ProductConfig[] = [
  {
    product: "tending",
    script: new URL("../mcp/tending.ts", import.meta.url),
    remoteUrlEnv: "TENDING_MCP_URL",
    remoteTokenEnv: "TENDING_MCP_BEARER_TOKEN",
  },
  {
    product: "swells",
    script: new URL("../mcp/swells.ts", import.meta.url),
    remoteUrlEnv: "SWELLS_MCP_URL",
    remoteTokenEnv: "SWELLS_MCP_BEARER_TOKEN",
  },
  {
    product: "glade",
    script: new URL("../mcp/glade.ts", import.meta.url),
    remoteUrlEnv: "GLADE_MCP_URL",
    remoteTokenEnv: "GLADE_MCP_BEARER_TOKEN",
  },
];

function inheritedEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export class McpToolHub {
  private clients: Client[] = [];
  private owners = new Map<string, Client>();
  private tools: AvailableTool[] = [];

  async connect() {
    for (const config of configs) {
      const client = new Client(
        { name: `attention-agent-${config.product}`, version: "0.1.0" },
        { versionNegotiation: { mode: "auto" } },
      );

      const remoteUrl = optionalEnv(config.remoteUrlEnv);
      if (remoteUrl) {
        const bearer = optionalEnv(config.remoteTokenEnv);
        const transport = new StreamableHTTPClientTransport(
          new URL(remoteUrl),
          bearer
            ? { requestInit: { headers: { authorization: `Bearer ${bearer}` } } }
            : undefined,
        );
        await client.connect(transport);
      } else {
        const transport = new StdioClientTransport({
          command: process.platform === "win32" ? "npx.cmd" : "npx",
          args: ["tsx", fileURLToPath(config.script)],
          env: inheritedEnv(),
        });
        await client.connect(transport);
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
    return this.tools;
  }

  listTools() {
    return [...this.tools];
  }

  requiresApproval(name: string) {
    const tool = this.tools.find((candidate) => candidate.name === name);
    if (!tool) return true;
    // Safety default: anything not explicitly declared read-only asks first.
    return tool.annotations?.readOnlyHint !== true;
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
