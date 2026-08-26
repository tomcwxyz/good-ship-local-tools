import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AttentionAgent } from "./model.js";
import { McpToolHub } from "./mcp.js";

const rl = createInterface({ input, output });
const hub = new McpToolHub();

function describeWrite(toolName: string, args: Record<string, unknown>) {
  if (toolName === "tending_create_moment") {
    return `Keep this as a Tending Moment?\n${String(args.content ?? "")}`;
  }
  if (toolName === "swells_create_observation") {
    return `Keep this as a Swells Observation?\n${String(args.text ?? "")}`;
  }
  return `Allow ${toolName}?\n${JSON.stringify(args, null, 2)}`;
}

try {
  const tools = await hub.connect();
  const agent = new AttentionAgent(hub, async (toolName, args) => {
    output.write(`\n\n${describeWrite(toolName, args)}\n`);
    const answer = (await rl.question("Confirm write [y/N]: ")).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  });

  output.write("\nAttention agent pilot\n");
  output.write("One agent across Tending, Swells and Glade. Writes always ask first.\n");
  output.write(`Connected ${tools.length} MCP tools. Type :tools to list them, :quit to exit.\n\n`);

  while (true) {
    const text = (await rl.question("you > ")).trim();
    if (!text) continue;
    if (text === ":quit" || text === ":exit") break;
    if (text === ":tools") {
      for (const tool of hub.listTools()) output.write(`- ${tool.name}: ${tool.description ?? ""}\n`);
      output.write("\n");
      continue;
    }

    try {
      const response = await agent.say(text);
      output.write(`\nagent > ${response}\n\n`);
    } catch (error) {
      output.write(`\nagent error > ${error instanceof Error ? error.message : String(error)}\n\n`);
    }
  }
} finally {
  rl.close();
  await hub.close();
}
