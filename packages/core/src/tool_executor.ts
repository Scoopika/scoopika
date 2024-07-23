import {
  ToolSchema,
  FunctionToolSchema,
  ApiToolSchema,
  AgentToolSchema,
  HooksHub,
  LLMToolCall,
  ToolCall,
} from "@scoopika/types";
import { validate } from "./utils";
import { Hookshub } from "./hooks";

interface ToolEntry {
  tool: ToolSchema;
  call: LLMToolCall;
}

export class ToolExecutor {
  run_id: string;
  session_id: string;
  tools: ToolEntry[];
  hooksHub: Hookshub;

  constructor({
    run_id,
    session_id,
    tools,
    hooksHub,
  }: {
    run_id: string;
    session_id: string;
    tools: ToolEntry[];
    hooksHub: HooksHub;
  }) {
    this.run_id = run_id;
    this.session_id = session_id;
    this.tools = tools;
    this.hooksHub = hooksHub;
  }

  async execute(): Promise<ToolCall[]> {
    const promises = this.tools.map(async (t) => await this.executeOne(t));
    const results = await Promise.all(promises);
    return results;
  }

  // the tool result can be anything, that's why it's any
  toolResult(result: any): string {
    if (typeof result === "object") {
      return JSON.stringify(result);
    }

    return `${result}`;
  }

  getArgs(args: string) {
    try {
      return { args: JSON.parse(args) };
    } catch {
      return { args: null };
    }
  }

  async executeOne({ tool, call }: ToolEntry): Promise<ToolCall> {
    this.hooksHub.executeHook("onToolCall", call);

    const parameters = tool.tool.function.parameters;

    const call_arguments = call.function.arguments;
    const { args } = this.getArgs(
      typeof call_arguments === "string"
        ? call_arguments
        : JSON.stringify(call_arguments),
    );

    const result: ToolCall = {
      call,
      result: "",
    };

    if (!args) {
      console.error(
        "Can't parse tool arguments as they are not a valid JSON object",
      );
      result.result = JSON.stringify({
        errors: "Invalid request: arguments are not a valid JSON object",
      });
      return result;
    }

    const validated_args = validate(parameters, args);

    if (validated_args.success === false) {
      result.result = JSON.stringify({
        errors: validated_args.errors,
      });

      return result;
    }

    if (tool.type === "function") {
      result.result = await this.executeFunction(tool, args);
      this.hooksHub.executeHook("onToolResult", result);
      return result;
    }

    if (tool.type === "api") {
      result.result = await this.executeApi(tool, args);
      this.hooksHub.executeHook("onToolResult", result);
      return result;
    }

    if (tool.type === "agent") {
      result.result = await this.executeAgent(tool, args);
      this.hooksHub.executeHook("onToolResult", result);
      return result;
    }

    if (tool.type !== "client-side") {
      throw new Error("ERROR: Unknown tool type");
    }

    await this.hooksHub.executeHook("onClientSideAction", {
      id: call.id,
      tool_name: tool.tool.function.name,
      arguments: args,
    });

    result.result = `Executed the action ${tool.tool.function.name} successfully, keep the conversation going and inform the user that the action was executed`;
    this.hooksHub.executeHook("onToolResult", result);

    return result;
  }

  async executeAgent(
    tool: AgentToolSchema,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (typeof args.instructions !== "string") {
      throw new Error(
        "Invalid instructions sent to an agent running as a tool",
      );
    }

    try {
      const result = await tool.executor(
        this.session_id,
        this.run_id,
        args.instructions,
      );

      return result;
    } catch (err) {
      console.error(err);
      return `Could not communicate with agent!`;
    }
  }

  async executeFunction(
    tool: FunctionToolSchema,
    args: Record<string, unknown>,
  ): Promise<string> {
    try {
      const result = await tool.executor(args);
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

  async executeApi(
    tool: ApiToolSchema,
    args: Record<string, unknown>,
  ): Promise<string> {
    const inputs: {
      headers: typeof tool.headers;
      body?: string;
    } = {
      headers: tool.headers,
    };

    if (tool.method.toLowerCase() !== "get") {
      inputs.body = this.replaceVariables(tool.body || "", args);
    }

    try {
      const response = await fetch(this.replaceVariables(tool.url, args), {
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
