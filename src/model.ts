import new_error from "./lib/error";
import { ToolRun } from "./tool";
import hosts from "./models/hosts";
import sleep from "./lib/sleep";
import * as types from "@scoopika/types";

class Model {
  public client: types.LLMClient;
  public prompt: types.Prompt;
  private host: types.LLMHost<any>;
  private tools: types.ToolSchema[] = [];
  private updated_history: types.LLMHistory[] = [];
  private follow_up_history: any[] = [];

  constructor(
    client: types.LLMClient,
    prompt?: types.Prompt,
    tools?: types.ToolSchema[],
  ) {
    this.client = client;
    this.prompt = prompt || ({} as types.Prompt);
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

  async baseRun(
    run_id: string,
    stream: types.StreamFunc,
    updateHistory: (history: types.LLMHistory) => undefined,
    inputs: types.LLMFunctionBaseInputs,
    chained: boolean,
    timeout?: number,
    execute_tools?: boolean,
  ): Promise<types.LLMTextResponse> {
    const messages = [
      ...inputs.messages,
      ...this.follow_up_history,
      ...this.updated_history,
    ];

    const output = await this.host.text(
      chained ? this.prompt.variable_name : "main",
      run_id,
      this.client.client,
      stream,
      {
        ...inputs,
        messages,
      },
    );

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

      const wanted_tool_schema = wanted_tools_schema[0];
      const tool_run = new ToolRun(
        wanted_tool_schema,
        JSON.parse(call_function.arguments),
      );
      const execution = await tool_run.execute();

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

    if (output.follow_up_history) {
      this.follow_up_history = output.follow_up_history;
    }

    if (calls_results.length > 0) {
      if (timeout) {
        await sleep(timeout);
      }
      return await this.baseRun(
        run_id,
        stream,
        updateHistory,
        inputs,
        chained,
        timeout,
        execute_tools,
      );
    }

    return output;
  }

  async jsonRun(
    inputs: types.LLMFunctionBaseInputs,
    schema: types.ToolParameters,
  ): Promise<types.LLMJsonResponse> {
    const response = this.host.json(this.client.client, inputs, schema);

    return response;
  }

  async imageRun(inputs: types.LLMFunctionImageInputs) {
    return await this.host.image(this.client.client, inputs);
  }
}

export default Model;
