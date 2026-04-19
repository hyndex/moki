import type { ActionDefinition, ResourceDefinition } from "@platform/schema";
import { toJsonSchema } from "@platform/schema";

import { createToolContract } from "@platform/ai";

export const packageId = "ai-mcp" as const;
export const packageDisplayName = "AI MCP" as const;
export const packageDescription = "MCP descriptors and connectors derived from framework actions, resources, and prompts." as const;

export type McpToolDescriptor = {
  id: string;
  title: string;
  description: string;
  permission: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  riskLevel: "low" | "moderate" | "high" | "critical";
  approvalMode: "none" | "required" | "conditional";
};

export type McpResourceDescriptor = {
  id: string;
  title: string;
  description: string;
  schema: Record<string, unknown>;
  curatedReadModel: boolean;
};

export type McpPromptDescriptor = {
  id: string;
  title: string;
  description: string;
  version: string;
  arguments?: Array<{ name: string; required: boolean }> | undefined;
};

export type McpServerDefinition = {
  id: string;
  label: string;
  tools: McpToolDescriptor[];
  resources: McpResourceDescriptor[];
  prompts: McpPromptDescriptor[];
};

export type McpClientConnector = {
  id: string;
  label: string;
  endpoint: string;
  hostAllowlist: string[];
  trustTier: "first-party" | "partner" | "unknown";
  secretRef?: string | undefined;
  requiresApproval: boolean;
  allowedToolIds?: string[] | undefined;
};

export function defineMcpServer(definition: McpServerDefinition): McpServerDefinition {
  return Object.freeze({
    ...definition,
    tools: [...definition.tools],
    resources: [...definition.resources],
    prompts: [...definition.prompts]
  });
}

export function defineMcpClientConnector(connector: McpClientConnector): McpClientConnector {
  return Object.freeze({
    ...connector,
    hostAllowlist: [...connector.hostAllowlist].sort((left, right) => left.localeCompare(right)),
    ...(connector.allowedToolIds ? { allowedToolIds: [...connector.allowedToolIds].sort((left, right) => left.localeCompare(right)) } : {})
  });
}

export function deriveMcpToolDescriptor(action: ActionDefinition, description = action.ai?.purpose ?? action.id): McpToolDescriptor {
  const tool = createToolContract(action, description);
  return {
    id: tool.id,
    title: action.id,
    description: tool.description,
    permission: tool.permission,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    riskLevel: tool.riskLevel,
    approvalMode: tool.approvalMode
  };
}

export function deriveMcpResourceDescriptor(
  resource: ResourceDefinition,
  description = resource.ai?.purpose ?? resource.id
): McpResourceDescriptor {
  return {
    id: resource.id,
    title: resource.id,
    description,
    schema: toJsonSchema(resource.contract),
    curatedReadModel: resource.ai?.curatedReadModel ?? false
  };
}

export function createMcpServerFromContracts(input: {
  id: string;
  label: string;
  actions: ActionDefinition[];
  resources: ResourceDefinition[];
  prompts?: McpPromptDescriptor[] | undefined;
}): McpServerDefinition {
  return defineMcpServer({
    id: input.id,
    label: input.label,
    tools: input.actions.map((action) => deriveMcpToolDescriptor(action)),
    resources: input.resources.map((resource) => deriveMcpResourceDescriptor(resource)),
    prompts: [...(input.prompts ?? [])]
  });
}
