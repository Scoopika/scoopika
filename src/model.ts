import new_error from "./lib/error";
import { ToolRun } from "./tool";
import hosts from "./models/hosts";
import sleep from "./lib/sleep";

class Model {
  public client: LLMClient;
  public prompt: Prompt;
  private host: LLMHost;
  private tools: ToolSchema[] = [];
  private updated_history: LLMHistory[] = [];
  private follow_up_history: any[] = [];

  constructor(client: LLMClient, prompt: Prompt, tools?: ToolSchema[]) {
    this.client = client;
    this.prompt = prompt;
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
    stream: StreamFunc,
    updateHistory: (history: LLMHistory) => undefined,
    inputs: LLMFunctionBaseInputs,
    timeout?: number,
  ): Promise<LLMTextResponse> {
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

    if (!output.tool_calls || output.tool_calls?.length < 1) {
      return output;
    }

    const calls_results: ToolHistory[] = [];

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
      const tool_call: LLMHistory = {
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
      return await this.baseRun(run_id, stream, updateHistory, inputs);
    }

    return output;
  }

  async jsonRun(
    inputs: LLMFunctionBaseInputs,
    schema: ToolParameters,
  ): Promise<LLMJsonResponse> {
    const response = this.host.json(this.client.client, inputs, schema);

    return response;
  }

  async imageRun(inputs: LLMFunctionImageInputs) {
    return await this.host.image(this.client.client, inputs);
  }
}

export default Model;
