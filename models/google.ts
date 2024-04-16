import new_error from "../lib/error";
import { GoogleGenerativeAI } from "@google/generative-ai";

const google: LLMHost = {
  model_role: "model",
  system_role: "user",

  text: async (
    run_id: string,
    client: GoogleGenerativeAI,
    stream: StreamFunc,
    inputs: LLMFunctionBaseInputs
  ) => {

    const model_inputs: {
      model: string,
      systemInstruction?: Record<string, any>,
      generationConfig: Record<string, any>,
    } = {
      model: inputs.model,
      generationConfig: inputs.options,
    };

    if (inputs.messages.length > 1) {
      model_inputs.systemInstruction = {
        role: "system",
        parts: [{text: inputs.messages[0].content}]
      };
      inputs.messages = inputs.messages.slice(1);
    }

    const model = client.getGenerativeModel({
      ...model_inputs as any,
      tools: [{functionDeclarations: inputs.tools.map(tool => tool.function)}],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY"
        }
      }
    });

    const history = inputs.messages.map(message => {
      if (message.role === "assistant" || message.role === "user") {
        return {
          role: message.role === "assistant" ? "model" : "user",
          parts: [{text: message.content}]
        }
      }

      if (message.role === "tool") {
        return {
          role: "function",
          parts: [{
            functionResponse: {
              name: message.name,
              response: {
                name: message.name,
                content: JSON.parse(message.content)
              }
            }
          }]
        }
      }

      return {
        role: "user",
        parts: [{text: message.content}]
      }

    })

    const chat = model.startChat({
      history: history.slice(0, history.length - 1),
      generationConfig: model_inputs.generationConfig
    })

    const response = await chat.sendMessage(inputs.messages[inputs.messages.length-1].content);
    const response_message = response.response.text();
    const tool_calls = await response.response.functionCalls();

    console.log(response_message);
    console.log(tool_calls);

    return {type: "text", content: ""};
  },

  image: async (_client, _inputs: LLMFunctionImageInputs) => {
    throw new Error(new_error(
      "image_generation_not_available",
      "image generation using google clients is not available",
      "image generation"
    ));
  }

};

export default google;
