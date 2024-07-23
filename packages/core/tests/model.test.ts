import { test, expect, expectTypeOf } from "vitest";
import { Scoopika, Model } from "../src";
import { getEnv } from "../src/utils";
import { z } from "zod";

const scoopika = new Scoopika({ token: "TOKEN" });
scoopika.connectProvider("groq", getEnv("GROQ", true) as string);

const model = new Model({
  scoopika,
  provider: "groq",
  model: "llama3-70b-8192",
});

test("Test model with Grop (OpenAI api): Text generation", async () => {
  let hooks_response: string = "";

  const system_prompt = "You are a helpful assistant called Hermoy";
  const { data: response, error } = await model.generateText({
    prompt: system_prompt,
    options: { session_id: "session1" },
    inputs: {
      message: "Hello! do you know that last song I played?",
      context: [
        {
          scope: "session",
          description: "Last played song",
          value: "Hotel California",
        },
      ],
    },
    hooks: {
      onToken: (t) => (hooks_response += t),
    },
  });

  const { data: response2, error: error2 } = await model.generateText({
    prompt: system_prompt,
    options: { session_id: "session1" },
    inputs: {
      message: "What was it again?",
    },
  });

  if (error !== null || error2 !== null) {
    throw new Error(
      error || error2 || "Unknown error somehow (you listen TS?) :)",
    );
  }

  expectTypeOf(response.content).toBeString();
  expect<number>(response.tool_calls.length).toBe(0);
  expect<number>(response.content.length).toBe(hooks_response.length);
  expect<boolean>(response2.content.toLowerCase().includes("hotel")).toBe(true);
});

test("Test model with Grop (OpenAI api): Function calling", async () => {
  let hooks_response: string = "";

  const { data: response, error } = await model.generateText({
    prompt: "You are a helpful assistant called Hermoy",
    inputs: {
      message: "Can you search for the user called Kais Radwan",
    },
    tools: [
      {
        type: "function",
        executor: async (args: Record<string, unknown>) => {
          return {
            name: args?.name,
            email: "kais@gmail.com",
            programming_languages: ["js", "ts", "py"],
          };
        },
        tool: {
          type: "function",
          function: {
            name: "search_users",
            description: "search for a user by its name",
            parameters: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "The name of the user to search for",
                },
              },
              required: ["name"],
            },
          },
        },
      },
    ],
    hooks: {
      onToken: (t) => (hooks_response += t),
    },
  });

  if (error !== null) {
    throw new Error(error);
  }

  expectTypeOf(response.content).toBeString();
  expect(response.tool_calls.length).toBeGreaterThan(0);
  expect(response.content.length).toBe(hooks_response.length);
});

test("Test model with Groq (OpenAI api): Object generation", async () => {
  const { data: response, error } = await model.generateObject({
    inputs: {
      message: "My name is Kais and I use Javascript",
    },
    schema: z.object({
      name: z.string().describe("The user name"),
      language: z
        .enum(["js", "ts"])
        .describe("The programming language the user uses"),
    }),
  });

  if (error !== null) {
    throw new Error(error);
  }

  expectTypeOf(response.name).toBeString();
  expectTypeOf(response.language).toBeString();
  expect(response.language).toBe("js");
});
