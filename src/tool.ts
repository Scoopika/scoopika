import {
  ToolSchema,
  FunctionToolSchema,
  ApiToolSchema,
  ServerClientActionStream,
} from "@scoopika/types";
import validate, { validateObject } from "./lib/validate";

class ToolRun {
  id: string;
  run_id: string;
  tool: ToolSchema;
  args: Record<string, any>;
  clientSideHook?: (action: ServerClientActionStream["data"]) => any;

  constructor(
    id: string,
    run_id: string,
    tool: ToolSchema,
    args: Record<string, any>,
    clientSideHook?: (action: ServerClientActionStream["data"]) => any,
  ) {
    this.id = id;
    this.run_id = run_id;
    this.tool = tool;
    this.args = args;
    this.clientSideHook = clientSideHook;
  }

  // the tool result can be anything, that's why it's any
  toolResult(result: any): string {
    if (typeof result === "object") {
      return JSON.stringify(result);
    }

    return `${result}`;
  }

  async execute(): Promise<any> {
    const parameters = this.tool.tool.function.parameters;
    const validated_args = validateObject(
      parameters.properties,
      parameters.required || [],
      this.args,
    );

    if (!validated_args.success) {
      return `ERROR: ${validated_args.error}`;
    }

    validate(parameters, validated_args.data);
    this.args = validated_args.data;

    if (this.tool.type === "function") {
      return await this.executeFunction(this.tool);
    }

    if (this.tool.type === "api") {
      return await this.executeApi(this.tool);
    }

    if (this.tool.type !== "client-side") {
      throw new Error("ERROR: Unknown tool type");
    }

    if (!this.clientSideHook) {
      throw new Error(
        "Needed to execute a tool on the client side but no hooks are found",
      );
    }

    await this.clientSideHook({
      id: this.id,
      tool_name: this.tool.tool.function.name,
      arguments: validated_args.data,
    });

    return "Performed Action!";
  }

  async executeFunction(tool: FunctionToolSchema): Promise<{ result: string }> {
    const result = await tool.executor(this.args);
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
