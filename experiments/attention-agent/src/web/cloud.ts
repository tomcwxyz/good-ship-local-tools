import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { DirectToolHub } from "../agent/direct.js";
import type { AgentSnapshot } from "../agent/model.js";
import { McpToolHub } from "../agent/mcp.js";
import { requiredEnv } from "../lib/http.js";

const remoteNames = ["TENDING_MCP_URL", "SWELLS_MCP_URL", "GLADE_MCP_URL"] as const;

export function isAuthorised(request: Request) {
  const expected = process.env.PILOT_ACCESS_KEY?.trim();
  const supplied = request.headers.get("x-pilot-key")?.trim();
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function cloudMode() {
  return remoteNames.every((name) => Boolean(process.env[name]?.trim())) ? "remote-mcp" as const : "direct-api" as const;
}

export function createCloudHub() {
  return cloudMode() === "remote-mcp" ? new McpToolHub({ allowStdio: false }) : new DirectToolHub();
}

function stateKey() {
  const secret = requiredEnv("AGENT_STATE_SECRET");
  if (secret.length < 32) throw new Error("AGENT_STATE_SECRET must be at least 32 characters");
  return createHash("sha256").update(secret).digest();
}

export function encryptState(snapshot: AgentSnapshot) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", stateKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(snapshot), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptState(token: string): AgentSnapshot {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid agent state");
  const decipher = createDecipheriv("aes-256-gcm", stateKey(), Buffer.from(parts[0], "base64url"));
  decipher.setAuthTag(Buffer.from(parts[1], "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(parts[2], "base64url")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as AgentSnapshot;
}
