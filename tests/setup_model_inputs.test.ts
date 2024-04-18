import { test, expect } from "vitest";
import setupInputs from "../lib/setup_model_inputs";
import { type } from "os";
import exp from "constants";

test("LLM inputs with no tools", () => {
  const inputs = setupInputs({
    model: "test_model",
    tools: [],
    options: {},
    messages: [
      { role: "user", content: "Hello" },
      { role: "model", content: "Hey" },
    ],
  });

  expect(inputs.model).toBe("test_model");
  expect(inputs.tools).toBe(undefined);
  expect(inputs.tool_choice).toBe(undefined);
  expect(inputs.messages.length).toBe(2);
});

test("LLM inputs with tools", () => {
  const inputs = setupInputs({
    model: "test_model",
    options: {},
    messages: [],
    tools: [
      {
        type: "function",
        function: {
          name: "func",
          description: "this is a function tool",
          parameters: {
            type: "object",
            properties: {
              input: {
                type: "string",
              },
            },
            required: ["input"],
          },
        },
      },
    ],
  });

  expect(typeof inputs.tools).toBe("object");
  expect(inputs.tools?.length).toBe(1);
  expect(inputs.tool_choice).toBe("auto");
});

test("LLM inputs with schema", () => {
  const inputs = setupInputs({
    model: "test_model",
    options: {},
    messages: [],
    tools: [],
    response_format: {
      type: "json_object",
      schema: {
        type: "object",
        properties: {
          input: { type: "string" },
        },
        required: ["input"],
      },
    },
  });

  expect(inputs.response_format?.type).toBe("json_object");
  expect(typeof inputs.response_format?.schema).toBe("object");
});
