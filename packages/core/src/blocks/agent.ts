import {
  CoreTool,
  Hooks,
  ModelObjectResponse,
  ModelTextResponse,
  RunInputs,
  RunOptions,
  Store,
  ToolSchema,
  AgentModelConfig,
  TextGenerationRequest,
  AgentJSONGenerationRequest,
  Voice,
} from "@scoopika/types";
import { z } from "zod";
import { Scoopika } from "../scoopika";
import { createTool, readError, toolToFunctionTool } from "../utils";
import { defaultBlockInputs, newBlockBuilder } from "./block";
import { Model } from "../model";
import { JSONSchema } from "openai/lib/jsonschema";
import { randomUUID } from "node:crypto";
import serverHooks from "../server/server_hooks";
import { readMemoryStore } from "../memory";

export class Agent {
  private scoopika: Scoopika;
  private tools: ToolSchema[] = [];
  private memory: Store;
  private model: string;
  private provider: string;
  public prompt: string;
  private knowledge?: string;
  private voice: Voice = "aura-orpheus-en";

  constructor(
    scoopika: Scoopika,
    { provider, model, prompt, knowledge, memory, voice }: AgentModelConfig,
  ) {
    this.scoopika = scoopika;
    this.prompt = prompt;
    this.provider = provider;
    this.model = model;
    this.memory = readMemoryStore(memory ?? scoopika.memory, scoopika.getToken(), scoopika.getUrl());
    if (knowledge) this.knowledge = knowledge;
    if (voice) this.voice = voice;
  }

  private async textBlock() {
    const builder = newBlockBuilder({
      inputs: z.object({
        ...defaultBlockInputs,
      }),
    });

    const agent_tools = this.tools;
    const Block = builder.compile(
      this.prompt,
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

    const block = new Block(`${randomUUID()}`, this.scoopika, {
      provider: this.provider,
      model: this.model,
      memory: this.memory,
      knowledge: this.knowledge,
      voice: this.voice
    });

    return block;
  }

  private jsonBlock() {
    const builder = newBlockBuilder({
      inputs: z.object({
        ...defaultBlockInputs,
        schema: z.any(),
        prompt: z.string().optional(),
        max_tries: z.number().optional(),
      }),
    });

    const Block = builder.compile(
      this.prompt,
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

    const block = new Block(`${randomUUID()}`, this.scoopika, {
      provider: this.provider,
      model: this.model,
      memory: this.memory,
      knowledge: this.knowledge
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
    const block = await this.textBlock();

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
    const block = this.jsonBlock();

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
    const model = new Model({
      scoopika: this.scoopika,
      provider: this.provider as any,
      model: this.model,
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

  async serve({
    request,
    stream,
    end,
  }: {
    request: Record<string, any> | unknown;
    stream: (value: string) => any;
    end?: () => any;
  }) {
    try {
      const req = request as any;

      if (req.type == "run_agent") {
        return await this.handleTextGeneration(req, stream);
      }

      if (req.type === "agent_generate_json") {
        return await this.handleJSONGeneration(req, stream);
      }

      throw new Error(
        `Invalid request: ${JSON.stringify(req, null, 4)}\n\nMake sure you have the latest version of Scoopika`,
      );
    } catch (err: any) {
      console.error(err);
      await stream(this.streamMessage(null, readError(err)));
    } finally {
      if (end) end();
    }
  }

  private async handleTextGeneration(
    request: TextGenerationRequest,
    stream: (v: string) => any,
  ) {
    await this.run({
      inputs: request.payload.inputs,
      options: request.payload.options,
      hooks: serverHooks(request.payload.hooks, stream),
    });
  }

  private async handleJSONGeneration(
    request: AgentJSONGenerationRequest,
    stream: (v: string) => any,
  ) {
    const { data, error } = await this.generateObjectWithSchema(
      request.payload,
    );

    await stream(this.streamMessage(data, error));
  }

  private streamMessage(data: any, error: string | null = null) {
    const msg = { data, error };
    return `<SCOOPSTREAM>${JSON.stringify(msg)}</SCOOPSTREAM>`;
  }
}
