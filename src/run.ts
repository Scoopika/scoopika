import buildPrompt from "./lib/build_prompt";
import Model from "./model";
import new_error from "./lib/error";
import * as types from "@scoopika/types";
import validate, { validateObject } from "./lib/validate";
import cleanToolParams from "./lib/clean_tool_params";
import buildMessage from "./lib/build_message";
import Hooks from "./hooks";

class Run {
  private clients: types.LLMClient[];
  private prompt: types.Prompt;
  public tools: types.ToolSchema[] = [];
  private agent: types.AgentData;
  private session: types.StoreSession;
  public built_prompt: string | undefined = undefined;
  public hooks: Hooks;

  constructor({
    clients,
    agent,
    tools,
    session,
    hooks,
  }: {
    clients: types.LLMClient[];
    agent: types.AgentData;
    tools?: types.ToolSchema[];
    session: types.StoreSession;
    hooks: Hooks;
  }) {
    this.clients = clients;
    this.agent = agent;
    this.tools = tools || [];
    this.session = session;
    this.hooks = hooks;

    const prompt = agent.prompts[0];
    if (!prompt) {
      throw new Error("The agent has no prompts!");
    }

    this.prompt = prompt;
  }

  async run({
    run_id,
    inputs,
    options,
    history,
  }: {
    run_id: string;
    inputs: types.RunInputs;
    options: types.RunOptions;
    history: types.LLMHistory[];
  }) {
    const client: types.LLMClient = this.getClient();
    const messages: types.LLMHistory[] = [...history];

    const prompt_content =
      (this.session.saved_prompts || {})[this.agent.id] ||
      this.validatePrompt(inputs);

    messages.unshift({
      role: "system",
      content: prompt_content,
    });

    const built_message = buildMessage(inputs);
    if (built_message.length > 0) {
      messages.push({
        role: "user",
        name: this.session.user_name,
        content: built_message,
      });
    }

    const model = new Model(client, this.tools);

    const llm_inputs: types.LLMFunctionBaseInputs = {
      model: this.prompt.model,
      options: this.prompt.options,
      messages,
      tools: this.tools.map((t) => ({
        type: "function",
        function: {
          ...t.tool.function,
          parameters: cleanToolParams(t.tool.function.parameters),
        },
      })),
    };

    const llm_output = await model.baseRun({
      run_id,
      session_id: options.session_id as string,
      inputs: llm_inputs,
      execute_tools: true,
      hooks: this.hooks,
    });

    return {
      response: llm_output,
      tools_history: model.tools_history,
    };
  }

  validatePrompt(user_inputs: types.RunInputs) {
    return `You are called ${this.agent.name} ` + this.prompt.content;
    // const prompt_inputs: Record<string, types.Parameter> = {};
    //
    // for (const i of this.prompt.inputs) {
    //   prompt_inputs[i.id] = {
    //     type: i.type,
    //     description: i.description,
    //     enum: i.enum,
    //     default: i.default,
    //     required: i.required,
    //   };
    // }
    //
    // const validation = validateObject(prompt_inputs, [], user_inputs);
    //
    // if (!validation.success) {
    //   throw new Error(validation.error);
    // }
    //
    // const built_prompt = buildPrompt(this.prompt, validation.data);
    //
    // if (built_prompt.missing.length > 0) {
    //   const missing = built_prompt.missing.map(
    //     (m) => `${m.id}: ${m.description}`,
    //   );
    //   throw new Error(
    //     new_error(
    //       "missing prompt variables",
    //       `Missing data: ${missing}`,
    //       "prompt validation",
    //     ),
    //   );
    // }
    //
    // const content =
    //   `You are called ${this.agent.name}. ` + built_prompt.content;
    // this.built_prompt = content;
    // return content;
  }

  getClient(): types.LLMClient {
    const wanted_clients = this.clients.filter(
      (client) => client.host === this.prompt.llm_client,
    );
    if (wanted_clients.length < 1) {
      throw new Error(
        new_error(
          "no_client",
          `Client '${this.prompt.llm_client}' not found for the prompt`,
          "prompt client validation",
        ),
      );
    }

    return wanted_clients[0];
  }

  async jsonRun<Data = Record<string, any>>({
    inputs,
    system_prompt,
    history,
    schema,
  }: {
    inputs?: types.RunInputs;
    schema: types.ToolParameters;
    system_prompt?: string;
    history: types.LLMHistory[];
  }) {
    const client = this.getClient();
    const messages: types.LLMHistory[] = [
      {
        role: "system",
        content:
          system_prompt ||
          "Your role is to extract JSON data from the context.",
      },
      ...history,
    ];

    const built_message = buildMessage(inputs || {});
    if (built_message.length > 0) {
      messages.push({
        role: "user",
        content: built_message,
      });
    }

    const model = new Model(client);
    const response = await model.jsonRun(
      {
        model: this.prompt.model,
        messages,
        tools: [],
        options: this.prompt.options,
        response_format: {
          type: "json_object",
          schema,
        },
      },
      cleanToolParams(schema),
    );

    const validated = validateObject(
      schema.properties,
      schema.required || [],
      response.content,
    );

    if (!validated.success) {
      throw new Error("Invalid LLM structured output");
    }

    validate(schema, validated.data);
    return validated.data as Data;
  }
}

export default Run;
