import new_error from "./lib/error";
import { ToolRun } from "./tool";
import hosts from "./models/hosts";
import * as types from "@scoopika/types";

class Model {
  public client: types.LLMClient;
  private host: types.LLMHost<any>;
  private tools: types.ToolSchema[] = [];
  private updated_history: types.LLMHistory[] = [];
  private follow_up_history: any[] = [];
  private calls: types.LLMToolCall[] = [];
  public tools_history: {
    call: types.LLMToolCall;
    result: any;
  }[] = [];

  constructor(client: types.LLMClient, tools?: types.ToolSchema[]) {
    this.client = client;

    const wanted_host = hosts[client.host];
    if (!wanted_host) {
      throw new Error(
        new_error(
          "invalid_host",
          `The host '${client.host}' is not available`,
          "LLM",
        ),
      );
    }

    this.host = wanted_host;

    if (tools) {
      this.tools = tools;
    }
  }

  async baseRun({
    run_id,
    stream,
    onToolCall,
    onToolRes,
    updateHistory,
    inputs,
    execute_tools,
  }: {
    run_id: string;
    stream: types.StreamFunc;
    onToolCall: (call: types.LLMToolCall) => any;
    onToolRes: (tool: { call: types.LLMToolCall; result: any }) => any;
    updateHistory: (history: types.LLMHistory) => undefined;
    inputs: types.LLMFunctionBaseInputs;
    execute_tools?: boolean;
  }): Promise<types.LLMTextResponse> {
    const messages = [
      ...inputs.messages,
      ...this.follow_up_history,
      ...this.updated_history,
    ];

    const output = await this.host.text(run_id, this.client.client, stream, {
      ...inputs,
      messages,
    });

    if (output.type !== "text") {
      return output;
    }

    if (
      !output.tool_calls ||
      output.tool_calls?.length < 1 ||
      execute_tools === false
    ) {
      return output;
    }

    const calls_results: types.ToolHistory[] = [];
    if (output.tool_calls) {
      this.calls = [...this.calls, ...output.tool_calls];
    }

    for (const tool_call of output.tool_calls) {
      const call_id = tool_call.id;
      const call_function = tool_call.function;

      const wanted_tools_schema = this.tools.filter(
        (tool) => tool.tool.function.name === call_function.name,
      );

      if (wanted_tools_schema.length < 1) {
        throw new Error(
          new_error(
            "tool_not_found",
            `The LLM wanted to call the tool '${call_function.name}' that's not found`,
            "LLM Run",
          ),
        );
      }

      try {
        JSON.parse(call_function.arguments);
      } catch {
        throw new Error(
          new_error(
            "invalid_json",
            "The LLM returned an invalid json object for the tool arguments",
            "LLM Run",
          ),
        );
      }

      onToolCall(tool_call);
      const wanted_tool_schema = wanted_tools_schema[0];
      const tool_run = new ToolRun(
        tool_call.id,
        run_id,
        wanted_tool_schema,
        JSON.parse(call_function.arguments),
      );
      const execution = await tool_run.execute();

      onToolRes({
        call: tool_call,
        result: execution.result,
      });

      this.tools_history.push({
        call: tool_call,
        result: execution.result,
      });

      calls_results.push({
        role: "tool",
        tool_call_id: call_id,
        name: call_function.name,
        content: execution.result,
      });
    }

    calls_results.forEach((call) => {
      const tool_call: types.LLMHistory = {
        role: "tool",
        tool_call_id: call.tool_call_id,
        name: call.name,
        content: call.content,
      };
      this.updated_history.push(tool_call);
      updateHistory(tool_call);
    });

    // Only used with Google Gemini, and running Google LLMs is not recommended anyways
    // So almost useless, just keep it for later
    if (output.follow_up_history) {
      this.follow_up_history = output.follow_up_history;
    }

    if (calls_results.length > 0) {
      return await this.baseRun({
        run_id,
        stream,
        onToolCall,
        onToolRes,
        updateHistory,
        inputs,
        execute_tools,
      });
    }

    return {
      ...output,
      tool_calls: this.calls,
      tools_history: this.tools_history,
    };
  }

  async jsonRun(
    inputs: types.LLMFunctionBaseInputs,
    schema: types.ToolParameters,
    stream: types.StreamFunc,
  ): Promise<types.LLMJsonResponse> {
    const response = this.host.json(this.client.client, inputs, schema, stream);

    return response;
  }

  async imageRun(
    run_id: string,
    stream: types.StreamFunc,
    inputs: types.LLMFunctionImageInputs,
  ) {
    return await this.host.image(run_id, this.client.client, stream, inputs);
  }
}

export default Model;
