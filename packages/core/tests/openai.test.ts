import OpenAI from "openai";
import { test, expect } from "vitest";
import { OpenAILLM } from "../src/llms";
import { Hookshub } from "../src/hooks";

const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ,
});

const llm = new OpenAILLM();
llm.init(openai, "llama3-70b-8192");

test("Test OpenAI LLM text generation", async () => {
  const hooks = new Hookshub();
  let msg: string = "";

  hooks.addHook("onToken", (t) => (msg += t));

  const res = await llm.generateText(
    {
      tools_results: [],
      messages: [],
      system_prompt: "You are a helpful AI assistant called Angie",
      prompt: {
        role: "user",
        content: "Hi, I'm Kais. What's your name?",
      },
    },
    hooks,
  );

  const content_length = res.content.length as number;
  expect(typeof res.content, "string");
  expect(typeof res.tool_calls, "array");
  expect(msg.length, content_length as any);
});

test("Test OpenAI LLM function calling", async () => {
  const hooks = new Hookshub();
  let msg: string = "";

  hooks.addHook("onToken", (t) => (msg += t));

  const res = await llm.generateText(
    {
      tools_results: [],
      messages: [],
      system_prompt: "You are a helpful AI assistant called Angie",
      prompt: {
        role: "user",
        content: "Search for the user with the ID 4941",
      },
      tools: [
        {
          type: "function",
          function: {
            name: "search_users",
            description: "Search for users based on user ID",
            parameters: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "The user ID to search for",
                },
              },
            },
          },
        },
      ],
    },
    hooks,
  );

  expect(typeof res.content, "string");
  expect(typeof res.tool_calls, "array");
  expect(res.tool_calls.length, 1 as any);
});

test("Test OpenAI LLM object generation", async () => {
  const res = await llm.generateObject(
    {
      prompt: {
        role: "user",
        content: "My name is Kais Radwan and I use Rust",
      },
      messages: [],
      schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
          },
          language: {
            type: "string",
            description: "The programming language the user uses",
            enum: ["js", "ts"],
          },
        },
        required: ["name"],
      },
      system_prompt:
        "You are a help AI assistant to help generate JSON data based on the provided JSON schema.",
    },
    new Hookshub(),
  );

  expect(typeof res, "string");
});
