import { Tool, ToolSchema } from "@scoopika/types";

export function toolSchemaToLLMTool(tool_schema?: ToolSchema): Tool {
  if (!tool_schema) {
    throw new Error(
      `No tool schema provided. maybe the tool called by the LLM doesn't exist`,
    );
  }

  return {
    type: "function",
    function: {
      name: tool_schema.tool.function.name,
      description: tool_schema.tool.function.description,
      parameters: tool_schema.tool.function.parameters,
    },
  };
}
