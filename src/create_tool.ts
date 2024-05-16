import { ToolFunction, ToolParameters } from "@scoopika/types";
import { JSONSchema } from "json-schema-to-ts";

export function createToolSchema(tool: {
  name: string;
  description: string;
  parameters: JSONSchema;
}): ToolFunction {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as any as ToolParameters,
  };
}
