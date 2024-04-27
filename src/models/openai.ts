import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources";
import setupInputs from "../lib/setup_model_inputs";
import new_error from "../lib/error";
import * as types from "@scoopika/types";

const openai: types.LLMHost<OpenAI> = {
  model_role: "assistant",
  system_role: "system",

  helpers: {},

  text: async (
    run_id: string,
    client: OpenAI,
    stream: types.StreamFunc,
    inputs: types.LLMFunctionBaseInputs,
  ): Promise<types.LLMTextResponse> => {
    const completion_inputs = setupInputs(inputs);

    console.log(inputs);

    const options_string = JSON.stringify(completion_inputs.options);
    delete completion_inputs.options;

    const response = await client.chat.completions.create({
      ...(completion_inputs as ChatCompletionCreateParamsStreaming),
      stream: true,
      ...JSON.parse(options_string),
    } as ChatCompletionCreateParamsStreaming);

    let response_message: string = "";
    let tool_calls: types.LLMToolCall[] | undefined = [];

    for await (const chunk of response) {
      if (chunk.choices[0].delta.content) {
        response_message += chunk.choices[0].delta.content;
        stream({
          run_id,
          content: chunk.choices[0].delta.content,
        });
      }

      tool_calls = chunk.choices[0].delta.tool_calls as
        | types.LLMToolCall[]
        | undefined;
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
      return openai.text(run_id, client, stream, { ...inputs, tools: [] });
    }

    return { type: "text", content: response_message, tool_calls };
  },

  json: async (
    client: OpenAI,
    inputs: types.LLMFunctionBaseInputs,
    schema: types.ToolParameters,
  ): Promise<types.LLMJsonResponse> => {
    const response = await openai.text("json_mode", client, (_stream) => {}, {
      ...inputs,
      response_format: { type: "json_object", schema },
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

  image: async (
    client: OpenAI,
    inputs: types.LLMFunctionImageInputs,
  ): Promise<types.LLMResponse> => {
    const response = await client.images.generate({
      model: inputs.model,
      prompt: inputs.prompt,
      n: inputs.n,
      size: inputs.size as any,
    });

    const images = response.data;
    const images_url: string[] = [];
    images.map((image) => {
      const image_url = image.url;
      if (typeof image_url === "string") {
        images_url.push(image_url);
      }
    });

    return { type: "image", content: images_url };
  },
};

export default openai;
