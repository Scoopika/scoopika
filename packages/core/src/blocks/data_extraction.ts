import { z } from "zod";
import { defaultBlockInputs, newBlockBuilder } from "./block";
import { Scoopika } from "../scoopika";
import { ProvidersName } from "@scoopika/types";
import { generate_object_prompt } from "../prompts";

export async function createDataExtractor<
  SCHEMA extends z.ZodTypeAny = any,
  DATA = z.infer<SCHEMA>,
>(
  scoopika: Scoopika,
  {
    name,
    schema,
    provider,
    model,
    prompt,
  }: {
    name?: string;
    schema: SCHEMA;
    provider: ProvidersName;
    model: string;
    prompt?: string;
  },
) {
  prompt = prompt || generate_object_prompt;

  const blockBuilder = newBlockBuilder({
    inputs: z.object({
      ...defaultBlockInputs,
      max_tries: z.number().optional(),
    }),
    response: z.union([
      z.object({ data: schema, error: z.null() }),
      z.object({ data: z.null(), error: z.string() }),
    ]),
  });

  const Block = blockBuilder.compile(
    prompt,
    async ({ prompt, model, inputs }) => {
      const res = await model.generateObject({
        prompt,
        ...inputs,
        schema,
        max_tries: inputs.inputs.max_tries,
      });

      return res;
    },
  );

  const block = new Block(name || "data-extraction", scoopika, {
    model,
    provider,
  });

  return block;
}
