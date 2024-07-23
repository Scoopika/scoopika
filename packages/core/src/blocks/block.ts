import {
  CoreTool,
  ToolSchema,
  DynamicBlockInputs,
  DefaultBlockInputs,
  BlockResponse,
  ProvidersName,
  NewBlockSchema,
} from "@scoopika/types";
import { JSONSchema } from "openai/lib/jsonschema";
import { z } from "zod";
import { Model } from "../model";
import { Scoopika } from "../scoopika";
import {
  createSchema,
  createTool,
  readError,
  toolToFunctionTool,
  validate,
} from "../utils";

export interface TextBlockMethodInputs<Init, Inputs, Variables> {
  prompt: string;
  model: Model;
  inputs: Inputs;
  tools: ToolSchema[];
  init: Init;
  variables: Variables;
}

export class DynamicBlock<
  Init,
  Inputs extends DefaultBlockInputs,
  Response,
  Variables,
> {
  method: ((
    data: TextBlockMethodInputs<Init, Inputs, Variables>,
  ) => Promise<Response>)[] = [];
  system_prompt: string = "You are a helpful AI assistant";
  init: Init;

  scoopika: Scoopika;
  model: Model;
  name: string;

  tools: ToolSchema[] = [];

  constructor(
    name: string,
    scoopika: Scoopika,
    options: {
      provider: ProvidersName;
      model: string;
    } & Init,
  ) {
    this.name = name;
    this.scoopika = scoopika;
    this.model = new Model({ scoopika, ...options });
    this.init = options;
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

  buildPrompt(template: string, variables: Variables) {
    let prompt = template.replace(
      /\{{(v..*?)}}/g,
      (_, v) => (variables as any)[v.substring(2)] || undefined,
    );

    return prompt.replace(
      /\{{(i..*?)}}/g,
      (_, v) => (this.init as any)[v.substring(2)] || undefined,
    );
  }

  async run(args: Inputs): Promise<BlockResponse<Response>> {
    if (this.method.length < 1) {
      return {
        data: null,
        error: "This block has not been compiled correctly",
      };
    }

    if (!args.inputs) {
      args.inputs = {};
    }

    try {
      const data = await this.method[0]({
        model: this.model,
        inputs: { ...args, options: args.options || {} },
        tools: this.tools,
        prompt: this.buildPrompt(
          this.system_prompt,
          args.variables as Variables,
        ),
        init: this.init,
        variables: args.variables as Variables,
      });

      return { data, error: null };
    } catch (err) {
      return { data: null, error: readError(err) };
    }
  }
}

export class BlockBuilder<
  DynamicInputs extends DynamicBlockInputs<any, any>,
  Init extends z.ZodTypeAny,
  Inputs extends z.ZodTypeAny,
  Response extends z.ZodTypeAny,
  Variables extends z.ZodTypeAny,
> {
  init_schema: JSONSchema;
  inputs_schema: JSONSchema;
  response_schema: JSONSchema;
  variables_schema: JSONSchema;

  constructor(
    init_schema: z.infer<Init>,
    inputs_schema: z.infer<Inputs>,
    response_schema: z.infer<Response>,
    variables_schema: z.infer<Variables>,
  ) {
    this.init_schema = createSchema(init_schema);
    this.inputs_schema = createSchema(inputs_schema);
    this.response_schema = createSchema(response_schema);
    this.variables_schema = createSchema(variables_schema);
  }

  compile(
    system_prompt: string,
    run: (
      data: TextBlockMethodInputs<
        z.infer<Init>,
        DynamicInputs,
        z.infer<Variables>
      >,
    ) => Promise<z.infer<Response>>,
  ) {
    const method: (
      data: TextBlockMethodInputs<
        z.infer<Init>,
        DynamicInputs,
        z.infer<Variables>
      >,
    ) => Promise<Response> = async (data) => {
      const inputs_valid = validate(this.inputs_schema, data.inputs.inputs);
      if (inputs_valid.success === false) {
        throw new Error(
          `Invalid block inputs:\n${inputs_valid.errors.join("\n")}`,
        );
      }

      const response = await run(data);

      const response_valid = validate(this.response_schema, response);
      if (response_valid.success === false) {
        throw new Error(
          `Invalid block inputs:\n${response_valid.errors.join("\n")}`,
        );
      }

      return response as Response;
    };

    class Block extends DynamicBlock<
      z.infer<Init>,
      DynamicInputs,
      z.infer<Response>,
      z.infer<Variables>
    > {
      system_prompt: string = system_prompt;
      method = [method];
    }

    return Block;
  }
}

export const defaultBlockInputs = {
  message: z.string().optional(),
  images: z.array(z.string()).optional(),
  audio: z
    .array(
      z.union([
        z.object({
          type: z.enum(["remote"]),
          path: z.string(),
        }),
        z.object({
          type: z.enum(["base64"]),
          value: z.string(),
        }),
      ]),
    )
    .optional(),
  urls: z.array(z.string()).optional(),
  context: z
    .array(
      z.object({
        description: z.string(),
        value: z.string(),
        scope: z.enum(["session", "run"]),
      }),
    )
    .optional(),
};

export function newBlockBuilder<
  Init extends z.ZodTypeAny = any,
  Inputs extends z.ZodTypeAny = any,
  Response extends z.ZodTypeAny = any,
  Variables extends z.ZodTypeAny = any,
>({
  init,
  inputs = defaultBlockInputs as any,
  response,
  variables,
}: NewBlockSchema<Init, Inputs, Response, Variables>) {
  return new BlockBuilder<
    DynamicBlockInputs<z.infer<Inputs>, z.infer<Variables>>,
    Init,
    Inputs,
    Response,
    Variables
  >(
    init || z.any(),
    inputs || z.any(),
    response || z.any(),
    variables || z.any(),
  );
}
