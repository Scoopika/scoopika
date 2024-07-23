import {
  Hooks,
  LLMTextResponse,
  ModelObjectInputs,
  RunInputs,
  RunOptions,
  SavedProvider,
  Store,
  ToolSchema,
  ToolMessage,
  ModelTextResponse,
  ToolCall,
  ValidTextModelResponse,
  ModelObjectResponse,
  ProvidersName,
} from "@scoopika/types";
import { Scoopika, Voice } from "./scoopika";
import { Hookshub } from "./hooks";
import {
  buildClient,
  buildInputs,
  buildMessage,
  createModelRun,
  createSchema,
  createUserRun,
  readError,
  toolSchemaToLLMTool,
  validate,
} from "./utils";
import { InMemoryStore } from "./memory";
import { randomUUID } from "crypto";
import { generate_object_prompt } from "./prompts";
import { z } from "zod";
import { ToolExecutor } from "./tool_executor";
import { TTS } from "./tts";
import { JSONSchema } from "openai/lib/jsonschema";

export class Model {
  scoopika: Scoopika;
  private provider: string;
  model: string;
  private memoryStore: Store = new InMemoryStore();
  private voice: Voice | undefined = undefined;

  constructor({
    scoopika,
    provider,
    model,
  }: {
    scoopika: Scoopika;
    provider: ProvidersName;
    model: string;
  }) {
    this.scoopika = scoopika;
    this.provider = provider;
    this.model = model;
    this.memoryStore = scoopika.memory;
  }

  private async getLLMClient() {
    const name = this.provider;
    const provider: SavedProvider =
      this.scoopika.providers[name] ?? (await this.scoopika.loadProvider(name));
    const client = buildClient(provider, this.model);

    return client;
  }

  private async getHistory({ options }: { options?: RunOptions }) {
    const session = options?.session_id ?? "session_" + randomUUID();
    const messages = await this.memoryStore.getRuns(session);

    return messages;
  }

  private async getInputs({
    inputs,
    options,
  }: {
    inputs: RunInputs;
    options?: RunOptions;
  }) {
    const session_id = options?.session_id ?? `session_${randomUUID()}`;
    const { new_inputs, context_message } = await buildInputs(
      this.scoopika,
      inputs,
    );
    const messages = await this.getHistory({
      options: { ...options, session_id },
    });
    const new_message = buildMessage(new_inputs);

    return { messages, new_message, context_message, session_id };
  }

  async generateText({
    inputs,
    options,
    hooks,
    prompt,
    tools,
  }: {
    inputs: RunInputs;
    options?: RunOptions;
    hooks?: Hooks;
    prompt?: string;
    tools?: ToolSchema[];
  }): Promise<ModelTextResponse> {
    const system_prompt = prompt || "";
    const run_id = `run_${randomUUID()}`;
    const client = await this.getLLMClient();
    const hooksHub = new Hookshub();
    const tts = new TTS({
      scoopika: this.scoopika,
      hooksHub,
      run_id,
      voice: this.voice,
    });
    hooksHub.addRunHooks(hooks || {});

    if (options?.voice) tts.turnOn();

    const { messages, new_message, context_message, session_id } =
      await this.getInputs({ inputs, options });

    let final: boolean = false;
    const tools_results: ToolMessage[] = [];
    const tool_calls: ToolCall[] = [];

    const generate = async (
      tools: ToolSchema[],
    ): Promise<LLMTextResponse | null> => {
      const response = await client.generateText(
        {
          system_prompt,
          prompt: { role: "user", content: new_message },
          messages,
          tools: (tools || []).map((t) => toolSchemaToLLMTool(t)),
          options: options?.llm,
          tools_results,
        },
        hooksHub,
      );

      final = response.tool_calls.length < 1;

      if (final && response.content.length < 1) {
        console.warn("Running model with no tools due to invalid response!");
        return await generate([]);
      }

      if (final) return response;

      const toolExecutor = new ToolExecutor({
        hooksHub,
        session_id,
        run_id,
        tools: response.tool_calls.map((call) => ({
          call,
          tool: (tools || []).filter(
            (t) => t.tool.function.name === call.function.name,
          )[0],
        })),
      });

      const calls = await toolExecutor.execute();

      tool_calls.push(...calls);
      tools_results.push(
        ...calls.map(
          (call): ToolMessage => ({
            name: call.call.function.name,
            tool_call_id: call.call.id,
            content: call.result,
            role: "tool",
          }),
        ),
      );

      console.info("Round trip");
      return await generate(tools);
    };

    const llm_response = await generate(tools || []);
    tools = [...(tools || []), ...(options?.tools || [])];

    if (!llm_response) {
      return {
        data: null,
        error: "Couldn't generate a text response for an unknown reason!",
      };
    }

    const voice_done = await tts.isDone();

    if (!voice_done) {
      console.error("Can't generate voice response for all text chunks");
    }

    const response: ValidTextModelResponse = {
      data: {
        tool_calls,
        content: llm_response.content,
        run_id,
        session_id,
        audio: tts.chunks,
      },
      error: null,
    };

    if (options?.save_history !== false) {
      await this.memoryStore.batchPushRuns(session_id, [
        createUserRun(session_id, run_id, inputs, context_message),
        createModelRun(session_id, run_id, response.data),
      ]);
    }

    hooksHub.executeHook("onFinish", response);
    hooksHub.executeHook("onModelResponse", response);

    return response;
  }

  async generateObjectWithSchema<DATA>({
    inputs,
    prompt,
    schema,
    options,
    max_tries,
  }: ModelObjectInputs<JSONSchema>): Promise<ModelObjectResponse<DATA>> {
    const client = await this.getLLMClient();
    const hooksHub = new Hookshub();
    const { messages, new_message } = await this.getInputs({ inputs, options });

    let system_prompt = prompt || generate_object_prompt;

    if (!this.model.includes("fireworks")) {
      system_prompt += `\n\nThe data HAS to be valid against this JSON schema:\n${JSON.stringify(schema)}`;
    }

    if (!system_prompt.toLowerCase().includes("json")) {
      system_prompt += "\nYour main mission is to generate JSON data";
    }

    max_tries = max_tries || 1; // even if 0 turn it to 1
    let tries: number = 0;
    let failed: boolean = false;
    let errors: string[] = [];

    const generate = async (): Promise<DATA | null> => {
      const response = await client.generateObject(
        {
          system_prompt,
          schema,
          messages,
          prompt: { role: "user", content: new_message },
          options: options?.llm,
        },
        hooksHub,
      );

      const data = JSON.parse(response);
      const is_valid = validate(schema, data);

      if (!is_valid.success) {
        tries += 1;
        errors = is_valid.errors;
        if (tries < max_tries) return await generate();
        return null;
      }

      return data;
    };

    const object = await generate().catch((err: any) => {
      errors.push(readError(err));
      failed = true;
    });

    if (!object || failed) {
      const error = errors.join("\n");
      return {
        data: null,
        error: `Couldn't generate a valid JSON object in ${tries} tries due to the following errors:\n${error}`,
      };
    }

    return {
      error: null,
      data: object as DATA,
    };
  }

  async generateObject<
    SCHEMA extends z.ZodTypeAny = any,
    DATA = z.infer<SCHEMA>,
  >(args: ModelObjectInputs<SCHEMA>): Promise<ModelObjectResponse<DATA>> {
    const json_schema = createSchema(args.schema);
    const res = await this.generateObjectWithSchema<DATA>({
      ...args,
      schema: json_schema,
    });

    return res;
  }
}
