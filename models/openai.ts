import OpenAI from "openai";
import type { 
  ChatCompletionCreateParamsStreaming 
} from "openai/resources";
import setupInputs from "../lib/setup_model_inputs";

const openai: LLMHost = {
  model_role: "assistant",
  system_role: "system",

  text: async (
    run_id: string,
    client: OpenAI,
    stream: StreamFunc,
    inputs: LLMFunctionBaseInputs,
  ): Promise<LLMResponse> => {

    const completion_inputs = setupInputs(inputs);
    const response = await client.chat.completions.create(
      {
        ...completion_inputs as ChatCompletionCreateParamsStreaming,
        stream: true,
        ...inputs.options
      },
    );

    let responseMessage: string = "";
    let tool_calls: LLMToolCall[] | undefined = [];

    for await (const chunk of response) {
      if (chunk.choices[0].delta.content) {
        responseMessage += chunk.choices[0].delta.content;
        stream({
          run_id,
          content: chunk.choices[0].delta.content
        })
      }

      tool_calls = chunk.choices[0].delta.tool_calls as LLMToolCall[] | undefined;
    }

    if (!tool_calls) {
      tool_calls = [];
    }

    tool_calls = tool_calls.filter(
      call => 
        typeof call.function.name === "string"
        && typeof call.function.arguments === "string"
    )

    if (responseMessage.length === 0 && tool_calls.length === 0) {
      return openai.text(run_id, client, stream, {...inputs, tools: []});
    }

    return { type: "text", content: responseMessage as string, tool_calls };
  },

  image: async (
    client: OpenAI,
    inputs: LLMFunctionImageInputs,
  ): Promise<LLMResponse> => {
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
