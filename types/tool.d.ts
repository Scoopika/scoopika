interface ToolParameters {
  type: "object";
  properties: Record<string, Parameter>;
  required?: Array<string>;
}

interface ToolFunction {
  name: string;
  description: string;
  parameters: ToolParameters;
}

interface Tool {
  type: "function";
  function: ToolFunction;
}

interface FunctionToolSchema {
  type: "function";
  executor: ((inputs: Record<string, any>) => any | Promise<any>);
  tool: Tool;
}

interface ApiToolSchema {
  type: "api";
  url: string;
  method: "get" | "post" | "delete" | "post" | "patch" | "put";
  headers: Record<string, string>;
  tool: Tool;
}

interface SubpromptToolSchema {
  type: "subprompt";
  prompt: Prompt;
  tool: Tool;
}

type ToolSchema = FunctionToolSchema | ApiToolSchema | SubpromptToolSchema;
