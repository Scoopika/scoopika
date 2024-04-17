import buildPrompt from "./lib/build_prompt";
import Model from "./model";
import mixHistory from "./lib/mix_history";
import new_error from "./lib/error";
import promptToTool from "./lib/prompt_to_tool";
import hosts from "./models/hosts";
import { sleep } from "openai/core";

class PromptChain {
  responses: Record<string, string> = {};
  saved_prompts: Record<string, string> = {};
  clients: LLMClient[];
  prompts: Prompt[];
  tools: ToolSchema[];
  session: StoreSession;
  stream: StreamFunc;
  statusUpdate: StatusUpdateFunc;

  constructor({
    session,
    clients,
    stream,
    statusUpdate,
    prompts,
    tools,
  }: {
    session: StoreSession;
    clients: LLMClient[];
    stream: StreamFunc;
    statusUpdate: StatusUpdateFunc;
    prompts: Prompt[];
    tools: ToolSchema[];
  }) {
    this.session = session;
    this.clients = clients;
    this.stream = stream;
    this.statusUpdate = statusUpdate;
    this.prompts = prompts;
    this.tools = tools;
  }

  async run({
    run_id, inputs, history, wanted_responses, timeout
  }:{
    run_id: string, 
    inputs: Inputs, 
    history: LLMHistory[],
    wanted_responses?: string[],
    timeout?: number
  }) {
    const prompts = this.prompts.sort((a, b) => a.index - b.index);
    const responses: Record<string, LLMResponse> = {};
    const updated_history: LLMHistory[] = [];

    const updateHistory = (new_history: LLMHistory): undefined => {
      const mixed_history = history[history.length-1] + mixHistory([new_history]);
      history[history.length-1] = {
        ...history[history.length-1],
        content: mixed_history
      };
      updated_history.push(new_history);
    }

    for await (const prompt of prompts) {
      const { client, validated_prompt } = await this.setupPrompt(
        prompt,
        inputs,
        history,
      );

      const is_conversational =
        typeof inputs.message === "string" && prompt.conversational !== false;

      const messages: LLMHistory[] = [
        {
          role: is_conversational ? hosts[client.host].system_role : "user",
          content: validated_prompt,
        },
        ...history,
      ];

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
        timeout
      );

      inputs[prompt.variable_name] = llmOutput.content as Input;
      responses[prompt.variable_name] = llmOutput;

      if (timeout) {
        await sleep(timeout);
      }
    }

    if (!wanted_responses || wanted_responses.length < 1) {
      return responses;
    }

    let results: Record<string, LLMResponse> = {};
    wanted_responses.map(wanted_response => {
      const response = responses[wanted_response];

      if (!response) {
        throw new Error(new_error(
          "invalid_wanted_response",
          `The wanted response ${wanted_response} is not available`,
          "prompt chain results"
        ))
      }

      results[wanted_response] = response;
    })

    return results;
  }

  async runPrompt(
    run_id: string,
    model: Model,
    updateHistory: (history: LLMHistory) => undefined,
    validated_prompt: string,
    messages: LLMHistory[],
    timeout?: number
  ): Promise<LLMResponse> {
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

    return model.baseRun(run_id, this.stream, updateHistory, {
      model: model.prompt.model,
      options: model.prompt.options,
      messages,
      tools: this.tools.map((tool) => tool.tool),
      tool_choice: model.prompt.tool_choice,
    }, timeout);
  }

  async setupPrompt(
    prompt: Prompt,
    inputs: Inputs,
    history: LLMHistory[],
  ): Promise<{
    client: LLMClient;
    validated_prompt: string;
  }> {
    const wanted_clients = this.clients.filter(client => client.host === prompt.llm_client);
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

    if (this.prompts.length === 0 && this.saved_prompts[prompt.variable_name]) {
      const validated_prompt = this.saved_prompts[prompt.variable_name];
      return { client, validated_prompt };
    }

    const built_prompt: BuiltPrompt = buildPrompt(prompt, inputs);

    const validated_prompt = await this.validatePrompt(
      prompt,
      built_prompt,
      inputs.message,
      mixHistory(history),
    );

    if (prompt.conversational) {
      this.saved_prompts[prompt.variable_name] = validated_prompt;
    }
    return { client, validated_prompt };
  }

  async validatePrompt(
    prompt: Prompt,
    built: BuiltPrompt,
    inputText: Input | undefined,
    context: string,
  ): Promise<string> {
    const json_mode = typeof inputText === "string" ? true : false;
    const missing = built.missing;
    if (missing.length === 0) {
      return built.content;
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

    const messages: LLMHistory[] = [
      {
        role: "user",
        name: this.session.user_name || "User",
        content: String(inputText),
      },
    ];

    const wanted_clients = this.clients.filter(client => client.host === prompt.llm_client);

    if (wanted_clients.length < 1) {
      throw new Error(new_error(
        "invalid_llm_client",
        `The wanted client ${prompt.llm_client} is not available`,
        "Json mode"
      ))
    }

    const original_missing = JSON.stringify(missing);
    const extracted_inputs = await this.jsonMode(
      wanted_clients[0],
      prompt,
      [ ...missing ],
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
    client: LLMClient,
    prompt: Prompt,
    inputs: PromptInput[],
    context: string,
  ): Promise<Inputs> {
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
      promptToTool(prompt, inputs).tool.function.parameters
    );

    return response.content as Inputs;
  }
}

export default PromptChain;
