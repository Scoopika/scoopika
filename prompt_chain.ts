import buildPrompt from "./lib/build_prompt";
import Model from "./model";
import mixHistory from "./lib/mix_history";
import new_error from "./lib/error";
import promptToTool from "./lib/prompt_to_tool";
import hosts from "./models/hosts";

class PromptChain {
  responses: Record<string, string> = {};
  saved_prompts: Record<string, string> = {};
  clients: Record<string, LLMClient>;
  prompts: Prompt[];
  tools: ToolSchema[];
  session: StoreSession;
  stream: StreamFunc;
  statusUpdate: StatusUpdateFunc;

  constructor({ session, clients, stream, statusUpdate, prompts, tools }: {
    session: StoreSession,
    clients: Record<string, LLMClient>,
    stream: StreamFunc,
    statusUpdate: StatusUpdateFunc,
    prompts: Prompt[],
    tools: ToolSchema[],
  }) {
    this.session = session;
    this.clients = clients;
    this.stream = stream;
    this.statusUpdate = statusUpdate;
    this.prompts = prompts;
    this.tools = tools;
  }

  async run(run_id: string, inputs: Inputs, history: LLMHistory[]) {
    const prompts = this.prompts.sort((a, b) => a.index - b.index);
    const responses: Record<string, LLMResponse> = {};

    for (const prompt of prompts) {
      const { client, validated_prompt } = await this.setupPrompt(
        run_id,
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

      const model = new Model(client, prompt);
      const llmOutput = await this.runPrompt(run_id, model, validated_prompt, messages);

      inputs[prompt.variable_name] = llmOutput.content as Input;
      responses[prompt.variable_name] = llmOutput;
    }

    return responses;
  }

  async runPrompt(
    run_id: string,
    model: Model,
    validated_prompt: string,
    messages: LLMHistory[],
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
        run_id,
        model.client,
        model.prompt,
        model.prompt.inputs,
        mixHistory(messages),
      );
      return { type: "object", content: json };
    }

    return model.baseRun(run_id, this.stream, {
      model: model.prompt.model,
      options: model.prompt.options,
      messages,
      tools: this.tools.map(tool => tool.tool),
      tool_choice: model.prompt.tool_choice,
    });
  }

  async setupPrompt(
    run_id: string,
    prompt: Prompt,
    inputs: Inputs,
    history: LLMHistory[],
  ): Promise<{
    client: LLMClient;
    validated_prompt: string;
  }> {
    const client = this.clients[prompt.llm_client];
    if (!client) {
      throw new Error(
        new_error(
          "no_client",
          `Client '${prompt.llm_client}' not found for the prompt '${prompt.variable_name}'`,
          "prompt chain run",
        ),
      );
    }

    if (this.prompts.length === 0 && this.saved_prompts[prompt.variable_name]) {
      const validated_prompt = this.saved_prompts[prompt.variable_name];
      return { client, validated_prompt };
    }

    const built_prompt: BuiltPrompt = buildPrompt(prompt, inputs);

    const validated_prompt = await this.validatePrompt(
      run_id,
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
    run_id: string,
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

    const extracted_inputs = await this.jsonMode(
      run_id,
      this.clients[prompt.llm_client],
      prompt,
      missing,
      `Context:\n${context}\n` + mixHistory(messages),
    );

    const new_built_prompt = buildPrompt(
      { ...prompt, inputs: missing },
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
    run_id: string,
    client: LLMClient,
    prompt: Prompt,
    inputs: PromptInput[],
    context: string,
  ): Promise<Inputs> {
    const model = new Model(client, prompt);
    const response = await model.baseRun(run_id, this.stream, {
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
      response_format: promptToTool(prompt, inputs).tool.function.parameters,
    });

    console.log(response);

    if (!response.content || typeof response.content !== "string") {
      throw new Error(
        new_error("invalid_json", "Invalid LLM JSON output", "json mode"),
      );
    }

    try {
      const jsonOutput = JSON.parse(response.content);
      return jsonOutput as Inputs;
    } catch {
      throw new Error(
        new_error(
          "invalid_llm_output",
          "Invalid LLM JSON output",
          "json mode validation",
        ),
      );
    }
  }
}

export default PromptChain;
