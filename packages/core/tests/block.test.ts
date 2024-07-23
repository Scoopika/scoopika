import { test, expect, expectTypeOf } from "vitest";
import { defaultBlockInputs, newBlockBuilder, Scoopika } from "../src";
import { z } from "zod";
import { getEnv } from "../src/utils";

const scoopika = new Scoopika({ token: "TOKEN" });
scoopika.connectProvider("groq", getEnv("GROQ", true) as string);

test("Text generation block", async () => {
  const blockBuilder = newBlockBuilder({
    init: z.object({
      mission: z.enum(["farmer", "worker"]),
    }),
    inputs: z.object({
      message: z.string(),
    }),
    variables: z.object({
      name: z.string().default("Angie"),
    }),
    response: z.string(),
  });

  let built_prompt: string = "";

  const Block = blockBuilder.compile(
    "You are an AI assistant called {{v.name}} with a mission: {{i.mission}}",
    async ({ prompt, model, inputs }) => {
      built_prompt = prompt;

      const { data, error } = await model.generateText({ ...inputs, prompt });
      if (error !== null) throw new Error(error);

      return data.content;
    },
  );

  const bl = new Block("my-block", scoopika, {
    provider: "groq",
    model: "llama3-70b-8192",
    mission: "farmer",
    memory: "memory",
  });

  const { data: content, error } = await bl.run({
    inputs: {
      message: "What's your name and what do you do?",
    },
    variables: {
      name: "Angie",
    },
  });

  if (error) {
    console.error(error);
  }

  expect(built_prompt.includes("farmer"), "System prompt i variables").toBe(
    true,
  );
  expect(built_prompt.includes("Angie"), "System prompt v variables").toBe(
    true,
  );
  expect(typeof content).toBe("string");
});

test("Object generation block", async () => {
  const response_schema = z.object({
    age: z
      .number()
      .optional()
      .describe(
        "The user age, include only if the age is provided by the user",
      ),
    name: z.string().describe("The user name"),
    language: z
      .enum(["js", "ts"])
      .describe("The programming language the user uses"),
  });

  const blockBuilder = newBlockBuilder({
    inputs: z.object({
      ...defaultBlockInputs,
    }),
    response: response_schema,
  });

  const Block = blockBuilder.compile(
    "Return JSON object with data about the user.",
    async ({ prompt, model, inputs }) => {
      const { data, error } = await model.generateObject({
        ...inputs,
        schema: response_schema,
        prompt,
      });

      if (error !== null) {
        throw new Error(error);
      }

      return data;
    },
  );

  const bl = new Block("my-block", scoopika, {
    provider: "groq",
    model: "llama3-70b-8192",
  });

  const { data, error } = await bl.run({
    inputs: {
      message: "My user name is Kais Radwan and I use Typescript and I'm 19",
    },
    options: {},
  });

  if (error) {
    console.error(error);
  }

  expect(typeof data?.name).toBe("string");
  expect(["js", "ts"].indexOf(data?.language || "NONE")).toBeGreaterThan(-1);
});
