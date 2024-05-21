import {
  ToolSchema,
  FunctionToolSchema,
  ApiToolSchema,
  ServerClientActionStream,
  AgentToolSchema,
} from "@scoopika/types";
import validate, { validateObject } from "./lib/validate";

class ToolRun {
  id: string;
  run_id: string;
  session_id: string;
  tool: ToolSchema;
  args: Record<string, any>;
  clientSideHook?: (action: ServerClientActionStream["data"]) => any;
  errorHook?: (e: { healed: boolean; error: string }) => any;

  constructor({
    id,
    run_id,
    session_id,
    tool,
    args,
    clientSideHook,
    errorHook,
  }: {
    id: string;
    run_id: string;
    session_id: string;
    tool: ToolSchema;
    args: Record<string, any>;
    clientSideHook?: (action: ServerClientActionStream["data"]) => any;
    errorHook?: (e: { healed: boolean; error: string }) => any;
  }) {
    this.id = id;
    this.run_id = run_id;
    this.session_id = session_id;
    this.tool = tool;
    this.args = args;
    this.clientSideHook = clientSideHook;
    this.errorHook = errorHook;
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

    if (this.tool.type === "agent") {
      return await this.executeAgent(this.tool);
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

    return `Executed the action ${this.tool.tool.function.name} successfully, keep the conversation going and inform the user that the action was executed`;
  }

  async executeAgent(tool: AgentToolSchema): Promise<string> {
    if (typeof this.args.instructions !== "string") {
      throw new Error(
        "Invalid instructions sent to an agent running as a tool",
      );
    }

    const result = await tool.executor(
      this.session_id,
      this.run_id,
      this.args.instructions,
    );

    return `${tool.tool.function.name} said: ` + result;
  }

  async executeFunction(tool: FunctionToolSchema): Promise<string> {
    try {
      const result = await tool.executor(this.args);
      return this.toolResult({ result });
    } catch (err: any) {
      const error: string = err.message || "Unexpected error!";
      return `The tool ${tool.tool.function.name} faced an error: ${error}`;
    }
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
