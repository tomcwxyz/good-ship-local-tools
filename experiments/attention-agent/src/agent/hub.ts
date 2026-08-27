export type AvailableTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
};

export interface ToolHub {
  connect(): Promise<AvailableTool[]>;
  listTools(): AvailableTool[];
  requiresApproval(name: string): boolean;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}
