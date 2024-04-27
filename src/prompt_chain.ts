import buildPrompt from "./lib/build_prompt";
import Model from "./model";
import mixHistory from "./lib/mix_history";
import new_error from "./lib/error";
import promptToTool from "./lib/prompt_to_tool";
import hosts from "./models/hosts";
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
    history,
    wanted_responses,
    timeout,
  }: {
    run_id: string;
    inputs: types.Inputs;
    history: types.LLMHistory[];
    wanted_responses?: string[];
    timeout?: number;
  }): Promise<types.AgentInnerRunResult> {
    const prompts = this.prompts.sort((a, b) => a.index - b.index);
    const responses: Record<string, types.LLMResponse> = {};
    const updated_history: types.LLMHistory[] = [];

    const updateHistory = (new_history: types.LLMHistory): undefined => {
      if (!new_history.name) {
        new_history.name = this.agent.name;
      }
      updated_history.push(new_history);
      if (history.length < 1) {
        history.push(new_history);
        return;
      }
      const mixed_history =
        history[history.length - 1].content + "\n" + mixHistory([new_history]);
      history[history.length - 1] = {
        ...history[history.length - 1],
        content: mixed_history,
      };
    };

    for await (const prompt of prompts) {
      const { client, validated_prompt } = await this.setupPrompt(
        prompt,
        inputs,
        history,
      );

      const is_conversational =
        typeof inputs.message === "string" && prompt.conversational !== false;

      const messages: types.LLMHistory[] = [
        {
          role: is_conversational ? hosts[client.host].system_role : "user",
          content: validated_prompt,
        },
      ];

      if (history.length > 0) {
        messages.push({ role: "user", content: mixHistory(history) });
      }

      if (is_conversational) {
        messages.push({
          role: "user",
          name: this.session.user_name || "User",
          content: String(inputs.message),
        });
      }

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

      if (timeout) {
        await sleep(timeout);
      }
    }

    if (!wanted_responses || wanted_responses.length < 1) {
      return { responses: responses, updated_history };
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

    return { responses: results, updated_history };
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
        mixHistory(messages),
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
        messages,
        tools: this.tools.map((tool) => tool.tool),
        tool_choice: model.prompt.tool_choice,
      },
      timeout,
    );
  }

  async setupPrompt(
    prompt: types.Prompt,
    inputs: types.Inputs,
    history: types.LLMHistory[],
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

    const validated_prompt = await this.validatePrompt(
      prompt,
      built_prompt,
      inputs.message,
      mixHistory(history),
    );

    if (prompt.conversational !== false) {
      this.saved_prompts[prompt.variable_name] = validated_prompt;
    }

    return { client, validated_prompt };
  }

  async validatePrompt(
    prompt: types.Prompt,
    built: types.BuiltPrompt,
    inputText: types.Input | undefined,
    context: string,
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

    const messages: types.LLMHistory[] = [
      {
        role: "user",
        name: this.session.user_name || "User",
        content: String(inputText),
      },
    ];

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
      `Context:\n${context}\n` + mixHistory(messages),
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
    context: string,
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
          { role: "user", content: context },
        ],
      },
      promptToTool(prompt, inputs).tool.function.parameters,
    );

    return response.content as types.Inputs;
  }
}

export default PromptChain;
