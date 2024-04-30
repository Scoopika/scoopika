import buildPrompt from "./lib/build_prompt";
import Model from "./model";
import mixHistory from "./lib/mix_history";
import new_error from "./lib/error";
import promptToTool from "./lib/prompt_to_tool";
import { sleep } from "openai/core";
import * as types from "@scoopika/types";

class PromptChain {
  public saved_prompts: Record<string, string> = {};
  private clients: types.LLMClient[];
  private prompts: types.Prompt[];
  private tools: types.ToolSchema[];
  private session: types.StoreSession;
  private stream: types.StreamFunc;
  private statusUpdate: types.StatusUpdateFunc;
  private agent: types.AgentData;
  public running_prompt: types.Prompt | undefined = undefined;

  constructor({
    session,
    agent,
    clients,
    stream,
    statusUpdate,
    prompts,
    tools,
    saved_prompts,
  }: {
    session: types.StoreSession;
    agent: types.AgentData;
    clients: types.LLMClient[];
    stream: types.StreamFunc;
    statusUpdate: types.StatusUpdateFunc;
    prompts: types.Prompt[];
    tools: types.ToolSchema[];
    saved_prompts?: Record<string, string>;
  }) {
    this.session = session;
    this.agent = agent;
    this.clients = clients;
    this.stream = stream;
    this.statusUpdate = statusUpdate;
    this.prompts = prompts;
    this.tools = tools;

    if (saved_prompts) {
      this.saved_prompts = saved_prompts;
    }
  }

  async run({
    run_id,
    inputs,
    messages,
    wanted_responses,
    timeout,
    onPromptResponse,
  }: {
    run_id: string;
    inputs: types.Inputs;
    messages: types.LLMHistory[];
    wanted_responses?: string[];
    timeout?: number;
    onPromptResponse?: (response: types.LLMResponse) => any;
  }): Promise<types.AgentInnerRunResult> {
    const prompts = this.prompts.sort((a, b) => a.index - b.index);
    const responses: Record<string, types.LLMResponse> = {};
    const updated_history: types.LLMHistory[] = [];
    let running_prompt: string = "";

    const updateHistory = (new_history: types.LLMHistory): undefined => {
      if (this.agent.chained) {
        updated_history.push({
          ...new_history,
          name: running_prompt,
          role: "prompt",
        });
        return;
      }

      updated_history.push({ ...new_history, name: this.agent.name });
    };

    for await (const prompt of prompts) {
      running_prompt = prompt.variable_name;
      const { client, validated_prompt } = await this.setupPrompt(
        prompt,
        inputs,
        messages,
      );

      const model = new Model(client, prompt, this.tools);
      const llmOutput = await this.runPrompt(
        run_id,
        model,
        updateHistory,
        validated_prompt,
        messages,
        timeout,
      );

      inputs[prompt.variable_name] = llmOutput.content as types.Input;
      responses[prompt.variable_name] = llmOutput;
      if (llmOutput.type === "text") {
        updateHistory({ role: "model", content: llmOutput.content });
      }

      if (onPromptResponse) {
        onPromptResponse(llmOutput);
      }

      if (timeout) {
        await sleep(timeout);
      }
    }

    const mixed_history: types.LLMHistory[] = [
      {
        role: "user",
        content:
          "Previous conversation context:\n" + mixHistory(updated_history),
      },
    ];

    if (!wanted_responses || wanted_responses.length < 1) {
      return { responses: responses, updated_history: mixed_history };
    }

    let results: Record<string, types.LLMResponse> = {};
    wanted_responses.map((wanted_response) => {
      const response = responses[wanted_response];

      if (!response) {
        throw new Error(
          new_error(
            "invalid_wanted_response",
            `The wanted response ${wanted_response} is not available`,
            "prompt chain results",
          ),
        );
      }

      results[wanted_response] = response;
    });

    return { responses: results, updated_history: mixed_history };
  }

  async runPrompt(
    run_id: string,
    model: Model,
    updateHistory: (history: types.LLMHistory) => undefined,
    validated_prompt: string,
    messages: types.LLMHistory[],
    timeout?: number,
  ): Promise<types.LLMResponse> {
    const prompt_type = model.prompt.type;

    if (prompt_type === "image") {
      return model.imageRun({
        prompt: validated_prompt,
        n: model.prompt.n,
        size: model.prompt.size,
        model: model.prompt.model,
      });
    }

    if (prompt_type === "json") {
      const json = this.jsonMode(
        model.client,
        model.prompt,
        model.prompt.inputs,
        messages,
      );
      return { type: "object", content: json };
    }

    return model.baseRun(
      run_id,
      this.stream,
      updateHistory,
      {
        model: model.prompt.model,
        options: model.prompt.options,
        messages: [{ role: "system", content: validated_prompt }, ...messages],
        tools: this.tools.map((tool) => tool.tool),
        tool_choice: model.prompt.tool_choice,
      },
      this.agent.chained,
      timeout,
    );
  }

  async setupPrompt(
    prompt: types.Prompt,
    inputs: types.Inputs,
    messages: types.LLMHistory[],
  ): Promise<{
    client: types.LLMClient;
    validated_prompt: string;
  }> {
    const wanted_clients = this.clients.filter(
      (client) => client.host === prompt.llm_client,
    );
    if (wanted_clients.length < 1) {
      throw new Error(
        new_error(
          "no_client",
          `Client '${prompt.llm_client}' not found for the prompt '${prompt.variable_name}'`,
          "prompt chain run",
        ),
      );
    }

    const client = wanted_clients[0];
    const built_prompt: types.BuiltPrompt = buildPrompt(prompt, inputs);

    let validated_prompt = await this.validatePrompt(
      prompt,
      built_prompt,
      inputs.message,
      messages,
    );

    if (prompt.conversational !== false) {
      this.saved_prompts[prompt.variable_name] = validated_prompt;
    }

    if (!this.agent.chained) {
      validated_prompt = `You are ${this.agent.name}, ` + validated_prompt;
    }

    return { client, validated_prompt };
  }

  async validatePrompt(
    prompt: types.Prompt,
    built: types.BuiltPrompt,
    inputText: types.Input | undefined,
    messages: types.LLMHistory[],
  ): Promise<string> {
    const json_mode = typeof inputText === "string" ? true : false;
    const missing = built.missing;
    if (missing.length === 0) {
      return built.content;
    }

    if (
      prompt.conversational !== false &&
      this.saved_prompts[prompt.variable_name]
    ) {
      const saved_prompt = this.saved_prompts[prompt.variable_name];
      return saved_prompt;
    }

    if (!json_mode) {
      const missingIds: string[] = built.missing.map((mis) => mis.id);
      throw new Error(
        new_error(
          "missing_inputs",
          `Missing inputs in prompt '${prompt.variable_name}': ${missingIds.join(",")}`,
          "prompt validation",
        ),
      );
    }

    const wanted_clients = this.clients.filter(
      (client) => client.host === prompt.llm_client,
    );

    if (wanted_clients.length < 1) {
      throw new Error(
        new_error(
          "invalid_llm_client",
          `The wanted client ${prompt.llm_client} is not available`,
          "Json mode",
        ),
      );
    }

    const original_missing = JSON.stringify(missing);
    const extracted_inputs = await this.jsonMode(
      wanted_clients[0],
      prompt,
      [...missing],
      messages,
    );

    const new_built_prompt = buildPrompt(
      { ...prompt, inputs: JSON.parse(original_missing) },
      extracted_inputs,
    );

    if (new_built_prompt.missing.length > 0) {
      throw new Error(
        new_error(
          "missing_inputs",
          `Can't extract all required inputs for the prompt '${prompt.variable_name}'`,
          "prompt validation",
        ),
      );
    }

    return new_built_prompt.content;
  }

  async jsonMode(
    client: types.LLMClient,
    prompt: types.Prompt,
    inputs: types.PromptInput[],
    messages: types.LLMHistory[],
  ): Promise<types.Inputs> {
    const model = new Model(client, prompt, this.tools);
    const response = await model.jsonRun(
      {
        model: prompt.model,
        tools: [],
        options: prompt.options,
        messages: [
          {
            role: "system",
            content: "Your role is to extract JSON data from the context.",
          },
          ...messages,
        ],
      },
      promptToTool(prompt, inputs).tool.function.parameters,
    );

    return response.content as types.Inputs;
  }
}

export default PromptChain;
