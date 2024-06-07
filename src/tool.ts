import {
  ToolSchema,
  FunctionToolSchema,
  ApiToolSchema,
  AgentToolSchema,
} from "@scoopika/types";
import validate, { validateObject } from "./lib/validate";
import Hooks from "./hooks";

class ToolRun {
  id: string;
  run_id: string;
  session_id: string;
  tool: ToolSchema;
  args: Record<string, any>;
  hooks: Hooks;

  constructor({
    id,
    run_id,
    session_id,
    tool,
    args,
    hooks,
  }: {
    id: string;
    run_id: string;
    session_id: string;
    tool: ToolSchema;
    args: Record<string, any>;
    hooks: Hooks;
  }) {
    this.id = id;
    this.run_id = run_id;
    this.session_id = session_id;
    this.tool = tool;
    this.args = args;
    this.hooks = hooks;
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

    if (this.hooks.hooks.onClientSideAction?.length || 0 < 1) {
      throw new Error(
        "Needed to execute a tool on the client side but no hooks are found",
      );
    }

    await this.hooks.executeHook("onClientSideAction", {
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

    try {
      const result = await tool.executor(
        this.session_id,
        this.run_id,
        this.args.instructions,
      );

      return result;
    } catch (err) {
      console.error(err);
      return `Could no communicate with agent!`;
    }
  }

  async executeFunction(tool: FunctionToolSchema): Promise<string> {
    try {
      const result = await tool.executor(this.args);
      return this.toolResult({ result });
    } catch (err: any) {
      console.error(err);
      const error: string = err.message || "Unexpected error!";
      return `The tool ${tool.tool.function.name} faced an error: ${error}`;
    }
  }

  private replaceVariables(template: string, variables: Record<string, any>) {
    return template.replace(/\${(.*?)}/g, (_, v) => variables[v] || "");
  }

  async executeApi(tool: ApiToolSchema) {
    const inputs: {
      headers: typeof tool.headers;
      body?: string;
    } = {
      headers: tool.headers,
    };

    const has_body = typeof tool.body === "string" && tool.body.length > 0;

    if (tool.method.toLowerCase() !== "get" && has_body) {
      inputs.body = this.replaceVariables(tool.body || "", this.args);
    }

    try {
      const response = await fetch(this.replaceVariables(tool.url, this.args), {
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
    } catch (err: any) {
      console.error(err);
      return `System faced an error executing the tool: ${err.message || "Unexpected error!"}`;
    }
  }
}

export { ToolRun };
