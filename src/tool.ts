import { ToolSchema, FunctionToolSchema, ApiToolSchema } from "@scoopika/types";
import validate from "./lib/validate";

class ToolRun {
  tool: ToolSchema;
  args: Record<string, any>;

  constructor(tool: ToolSchema, args: Record<string, any>) {
    validate(tool.tool.function.parameters, args);
    this.tool = tool;
    this.args = args;
  }

  // the tool result can be anything, that's why it's any
  toolResult(result: any): string {
    if (typeof result === "object") {
      return JSON.stringify(result);
    }

    return JSON.stringify({ result });
  }

  async execute(): Promise<{ result: string }> {
    if (this.tool.type === "function") {
      return await this.executeFunction(this.tool);
    }

    if (this.tool.type === "api") {
      return await this.executeApi(this.tool);
    }

    return { result: this.toolResult("Invalid tool execution") };
  }

  async executeFunction(tool: FunctionToolSchema): Promise<{ result: string }> {
    let result = await tool.executor(this.args);
    return { result: this.toolResult(result) };
  }

  async executeApi(tool: ApiToolSchema): Promise<{ result: string }> {
    const inputs: {
      method: typeof tool.method;
      headers: typeof tool.headers;
      data?: Record<string, any>;
    } = { method: tool.method, headers: tool.headers };

    if (tool.method !== "get") {
      inputs.data = this.args;
    }

    const response = await fetch(tool.url, {
      ...inputs,
      method: tool.method.toUpperCase(),
    });

    try {
      const data = await response.json();
      return { result: this.toolResult(data) };
    } catch {
      const data = await response.text();
      return { result: this.toolResult(data) };
    }
  }
}

export { ToolRun };
