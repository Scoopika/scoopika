import { ClientSideToolSchema, ToolFunction } from "@scoopika/types";

export default function madeActionToFunctionTool({
  execute,
  schema,
}: {
  execute: (inputs: any) => any;
  schema: ToolFunction;
}): ClientSideToolSchema {
  return {
    type: "client-side",
    executor: execute,
    tool: {
      type: "function",
      function: schema,
    },
  };
}
