export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function vercelBypassHeaders(envName: string): Record<string, string> {
  const secret = process.env[envName]?.trim();
  return secret ? { "x-vercel-protection-bypass": secret } : {};
}

export function createApiClient(
  baseUrl: string,
  bearerToken: string,
  defaultHeaders: Record<string, string> = {},
) {
  const base = baseUrl.replace(/\/$/, "");

  return async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${bearerToken}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...defaultHeaders,
        ...init.headers,
      },
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`API request failed (${response.status}): ${body.slice(0, 600)}`);
    }

    if (!body) return undefined as T;
    return JSON.parse(body) as T;
  };
}

export function jsonToolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent:
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : { data: value },
  };
}
