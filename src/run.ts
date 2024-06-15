import Model from "./model";
import new_error from "./lib/error";
import * as types from "@scoopika/types";
import validate, { validateObject } from "./lib/validate";
import cleanToolParams from "./lib/clean_tool_params";
import buildMessage from "./lib/build_message";
import Hooks from "./hooks";
import Scoopika from "./scoopika";

class Run {
  private scoopika: Scoopika;
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
    scoopika,
  }: {
    clients: types.LLMClient[];
    agent: types.AgentData;
    tools?: types.ToolSchema[];
    session: types.StoreSession;
    hooks: Hooks;
    scoopika: Scoopika;
  }) {
    this.clients = clients;
    this.agent = agent;
    this.scoopika = scoopika;
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

    const built_message = buildMessage(inputs);
    if (built_message.length > 0) {
      messages.push({
        role: "user",
        name: this.session.user_name,
        content: built_message,
      });
    }

    const prompt_content = await this.generatePrompt(built_message);

    messages.unshift({
      role: "system",
      content: prompt_content,
    });

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

  async generatePrompt(
    message: string | (types.UserTextContent | types.UserImageContent)[],
  ): Promise<string> {
    let prompt = `You are called ${this.agent.name}. ` + this.prompt.content;
    let text: string = "";

    if (typeof message === "string") {
      text = message;
    } else {
      const text_messages = message.filter(
        (m) => m.type === "text",
      ) as types.UserTextContent[];
      text = text_messages.map((m) => m.text).join("\n");
    }

    const rag = await this.scoopika.rag(this.agent.id, text);

    if (rag.length > 0) {
      prompt += "\nUseful information:\n" + rag;
    }

    return prompt;
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
