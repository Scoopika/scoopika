import {
  ToolSchema,
  FunctionToolSchema,
  ApiToolSchema,
  AgentToolSchema,
} from "@scoopika/types";
import validate from "./lib/validate";
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
    const validated_args = validate(parameters, this.args);

    if (!validated_args.success) {
      return JSON.stringify({
        errors: validated_args.errors,
      });
    }

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

    await this.hooks.executeHook("onClientSideAction", {
      id: this.id,
      tool_name: this.tool.tool.function.name,
      arguments: this.args,
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
    return template.replace(/\${(.*?)}/g, (_, v) => variables[v] || undefined);
  }

  async executeApi(tool: ApiToolSchema): Promise<string> {
    const inputs: {
      headers: typeof tool.headers;
      body?: string;
    } = {
      headers: tool.headers,
    };

    if (tool.method.toLowerCase() !== "get") {
      inputs.body = this.replaceVariables(tool.body || "", this.args);
    }

    try {
      const response = await fetch(this.replaceVariables(tool.url, this.args), {
        ...inputs,
        method: tool.method.toUpperCase(),
      });

      const data = await response.text();
      return data;
    } catch (err: any) {
      console.error(err);
      return `System faced an error executing the tool: ${err.message || "Unexpected error!"}`;
    }
  }
}

export { ToolRun };
