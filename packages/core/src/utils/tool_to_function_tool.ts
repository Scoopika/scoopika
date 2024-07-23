import { FunctionToolSchema, ToolFunction } from "@scoopika/types";

export function toolToFunctionTool({
  execute,
  schema,
}: {
  execute: (inputs: any) => any;
  schema: ToolFunction;
}): FunctionToolSchema {
  return {
    type: "function",
    executor: execute,
    tool: {
      type: "function",
      function: schema,
    },
  };
}
