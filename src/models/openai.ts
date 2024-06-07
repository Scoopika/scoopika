import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources";
import setupInputs from "../lib/setup_model_inputs";
import new_error from "../lib/error";
import * as types from "@scoopika/types";
import crypto from "node:crypto";
import Hooks from "../hooks";

const openai: types.LLMHost<OpenAI> = {
  model_role: "assistant",
  system_role: "system",

  helpers: {},

  text: async ({
    run_id,
    client,
    hooks,
    inputs,
  }: {
    run_id: string;
    client: OpenAI;
    hooks: types.HooksClass;
    inputs: types.LLMFunctionBaseInputs;
  }): Promise<types.LLMTextResponse> => {
    const completion_inputs = setupInputs(inputs);
    const options = JSON.parse(JSON.stringify(completion_inputs.options));
    delete completion_inputs.options;

    const response = await client.chat.completions.create({
      ...(completion_inputs as ChatCompletionCreateParamsStreaming),
      stream: true,
      ...options,
    } as ChatCompletionCreateParamsStreaming);

    let response_message: string = "";
    let tool_calls: types.LLMToolCall[] = [];

    for await (const chunk of response) {
      if (chunk.choices[0].delta.content) {
        response_message += chunk.choices[0].delta.content;
        const stream: types.StreamMessage = {
          type: "text",
          run_id,
          content: chunk.choices[0].delta.content,
        };
        hooks.executeHook("onStream", stream);
        hooks.executeHook("onOutput", stream);
        hooks.executeHook("onToken", chunk.choices[0].delta.content);
      }

      const calls = chunk.choices[0].delta.tool_calls;

      if (!calls || calls.length < 1) {
        continue;
      }

      for await (const call of calls) {
        const saved_call = tool_calls[call.index];
        if (!saved_call) {
          tool_calls[call.index] = {
            id: call.id || crypto.randomUUID(),
            type: "function",
            function: {
              name: call.function?.name || "",
              arguments: call.function?.arguments || "",
            },
          };
          continue;
        }

        if (call.id && saved_call.id !== call.id) {
          tool_calls[call.index].id = call.id;
        }

        if (!call.function) {
          continue;
        }

        if (
          call.function.name &&
          call.function.name !== saved_call.function.name
        ) {
          tool_calls[call.index].function.name = call.function.name;
        }

        if (
          call.function.arguments &&
          call.function.arguments !== saved_call.function.arguments
        ) {
          tool_calls[call.index].function.arguments += call.function.arguments;
        }
      }
    }

    if (!tool_calls) {
      tool_calls = [];
    }

    tool_calls = tool_calls.filter(
      (call) =>
        typeof call.function.name === "string" &&
        typeof call.function.arguments === "string",
    );

    if (response_message.length === 0 && tool_calls.length === 0) {
      return await openai.text({
        run_id,
        client,
        hooks,
        inputs: {
          ...inputs,
          tools: [],
        },
      });
    }

    return {
      type: "text",
      content: response_message,
      tool_calls,
      tools_history: [],
    };
  },

  json: async (
    client: OpenAI,
    inputs: types.LLMFunctionBaseInputs,
    schema: types.ToolParameters,
  ): Promise<types.LLMJsonResponse> => {
    const response = await openai.text({
      run_id: "JSON_MODE",
      client,
      hooks: new Hooks(),
      inputs: {
        ...inputs,
        response_format: { type: "json_object", schema },
      },
    });

    if (!response.content || response.content.length < 1) {
      throw new Error(
        new_error(
          "Invalid LLM response",
          "Expected LLM response to be a JSON. please make sure you're not using tools to prompt chains",
          "Json mode",
        ),
      );
    }

    try {
      const data = JSON.parse(response.content);
      return { type: "object", content: data };
    } catch {
      throw new Error(
        new_error(
          "Invalid LLM response",
          "LLM response is not a valid JSON object",
          "Json mode",
        ),
      );
    }
  },
};

export default openai;
