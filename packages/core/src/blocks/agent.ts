import {
  AgentData,
  AgentToolSchema,
  CoreTool,
  Hooks,
  InTool,
  ModelObjectResponse,
  ModelTextResponse,
  RunInputs,
  RunOptions,
  Store,
  ToolSchema,
} from "@scoopika/types";
import { z } from "zod";
import { Scoopika } from "../scoopika";
import { agentAsTool, createTool, toolToFunctionTool } from "../utils";
import { defaultBlockInputs, newBlockBuilder } from "./block";
import { Model } from "../model";
import { JSONSchema } from "openai/lib/jsonschema";

export class Agent {
  agent: AgentData | null = null;
  private scoopika: Scoopika;
  id: string;
  private url: string;
  private tools: ToolSchema[] = [];
  private memory: Store;
  private model: Model | null = null;

  constructor(id: string, scoopika: Scoopika) {
    this.scoopika = scoopika;
    this.url = scoopika.getUrl() + `/main/agent/${id}`;
    this.id = id;
    this.memory = scoopika.memory;
  }

  async load() {
    const res = await fetch(this.url, {
      headers: {
        authorization: this.scoopika.getToken(),
      },
    });

    const status = res.status;
    const data = await res.json();

    if (!data?.agent) {
      throw new Error(
        data?.error ||
          `Unknown remote error while loading agent. status: ${status}`,
      );
    }

    const agent = data.agent as AgentData;

    if (agent.in_tools?.length || 0 > 0) {
      await this.buildInTools(agent, agent.in_tools || []);
    }

    this.agent = agent;

    this.model = new Model({
      scoopika: this.scoopika,
      provider: agent.prompts[0].llm_client as any,
      model: agent.prompts[0].model,
    });

    return agent;
  }

  async textBlock(agent: AgentData) {
    const builder = newBlockBuilder({
      inputs: z.object({
        ...defaultBlockInputs,
      }),
    });

    const agent_tools = this.tools;
    const Block = builder.compile(
      `You are an AI assistant called ${agent.name}. ` +
        agent.prompts[0].content,
      async ({ prompt, model, inputs, tools }) => {
        const { data, error } = await model.generateText({
          prompt,
          ...inputs,
          tools: [...(tools || []), ...agent_tools],
        });

        if (error !== null) {
          throw new Error(error);
        }

        return data;
      },
    );

    const block = new Block(agent.id, this.scoopika, {
      provider: agent.prompts[0].llm_client,
      model: agent.prompts[0].model,
      memory: this.memory,
    });

    return block;
  }

  jsonBlock(agent: AgentData) {
    const builder = newBlockBuilder({
      inputs: z.object({
        ...defaultBlockInputs,
        schema: z.any(),
        prompt: z.string().optional(),
        max_tries: z.number().optional(),
      }),
    });

    const Block = builder.compile(
      `You are an AI assistant called ${agent.name}. ` +
        agent.prompts[0].content,
      async ({ prompt, model, inputs }) => {
        const { data, error } = await model.generateObject({
          ...inputs,
          schema: inputs.inputs.schema,
          prompt: inputs.inputs.prompt ?? prompt,
          max_tries: inputs.inputs.max_tries,
        });

        if (error !== null) {
          throw new Error(error);
        }

        return data;
      },
    );

    const block = new Block(agent.id, this.scoopika, {
      provider: agent.prompts[0].llm_client,
      model: agent.prompts[0].model,
      memory: this.memory,
    });

    return block;
  }

  async run({
    inputs,
    options,
    hooks,
  }: {
    inputs: RunInputs;
    options?: RunOptions;
    hooks?: Hooks;
  }): Promise<ModelTextResponse> {
    const agent = this.agent || (await this.load());
    const block = await this.textBlock(agent);

    return (await block.run({ inputs, options, hooks })) as ModelTextResponse;
  }

  async structuredOutput<
    SCHEMA extends z.ZodTypeAny = any,
    DATA = z.infer<SCHEMA>,
  >({
    inputs,
    options,
    schema,
    prompt,
    max_tries,
  }: {
    inputs: RunInputs;
    options?: RunOptions;
    schema: SCHEMA;
    prompt?: string;
    max_tries?: number;
  }) {
    const agent = this.agent || (await this.load());
    const block = this.jsonBlock(agent);

    return (await block.run({
      inputs: { ...inputs, schema, prompt, max_tries },
      options,
    })) as ModelObjectResponse<DATA>;
  }

  async generateObjectWithSchema(args: {
    inputs: RunInputs;
    options?: RunOptions;
    schema: JSONSchema;
    prompt?: string;
    max_tries?: number;
  }) {
    const agent = this.agent || (await this.load());
    const model = new Model({
      scoopika: this.scoopika,
      provider: agent.prompts[0].llm_client as any,
      model: agent.prompts[0].model,
    });

    const data = await model.generateObjectWithSchema(args);
    return data;
  }

  addTool<PARAMETERS extends z.ZodTypeAny, RESULT = any>(
    tool_schema: CoreTool<PARAMETERS, RESULT>,
  ) {
    const tool = createTool(tool_schema);
    this.tools = [
      ...this.tools.filter((t) => t.tool.function.name !== tool.schema.name),
      toolToFunctionTool(tool),
    ];
  }

  removeToll(name: string) {
    this.tools = this.tools.filter((t) => t.tool.function.name !== name);
  }

  public async addAgentAsTool(agent: Agent) {
    const agent_tool = await agent.asTool();
    this.tools.push(agent_tool);

    return this;
  }

  private async buildInTools(agent: AgentData, in_tools: InTool[]) {
    for (const tool of in_tools) {
      if (tool.type === "agent") {
        const agent = new Agent(tool.id, this.scoopika);
        await this.addAgentAsTool(agent);
        continue;
      }

      const headers: Record<string, string> = {};
      tool.headers.forEach((h) => {
        headers[h.key] = h.value;
      });

      this.tools = [
        ...(this.tools.filter((t) => t.tool.function.name !== tool.name) || []),
        {
          type: "api",
          url: tool.url,
          method: tool.method,
          headers,
          body: tool.body,
          tool: {
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputs,
            },
          },
        },
      ];
    }
  }

  public async asTool(): Promise<AgentToolSchema> {
    const agent = this.agent || (await this.load());
    const runFunc = this.run.bind(this);

    const executor: AgentToolSchema["executor"] = async (
      session_id: string,
      run_id: string,
      instructions: string,
    ) => {
      const { data, error } = await runFunc({
        options: { session_id, run_id, save_history: false },
        inputs: {
          message: instructions,
        },
      });

      if (error !== null) return error;

      return data.content;
    };

    const tool = agentAsTool(agent, executor);
    return tool;
  }
}
