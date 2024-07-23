import { z } from "zod";
import { defaultBlockInputs, newBlockBuilder } from "./block";
import { Scoopika } from "../scoopika";
import { ProvidersName, Store } from "@scoopika/types";
import { generate_object_prompt } from "../prompts";
import { JSONSchema } from "openai/lib/jsonschema";

export function createDynamicDataExtractor(
  scoopika: Scoopika,
  {
    name,
    schema,
    provider,
    model,
    prompt,
    memory,
  }: {
    name?: string;
    schema: JSONSchema;
    provider: ProvidersName;
    model: string;
    prompt?: string;
    memory?: string | Store;
  },
) {
  prompt = prompt || generate_object_prompt;

  const blockBuilder = newBlockBuilder({
    inputs: z.object({
      ...defaultBlockInputs,
      max_tries: z.number().optional(),
    }),
    response: z.any(),
  });

  const Block = blockBuilder.compile(
    prompt,
    async ({ prompt, model, inputs }) => {
      const res = await model.generateObjectWithSchema<any>({
        prompt,
        ...inputs,
        schema,
        max_tries: inputs.inputs.max_tries,
      } as any);

      return res;
    },
  );

  const block = new Block(name || "data-extraction", scoopika, {
    model,
    provider,
    memory,
  });

  return block;
}
