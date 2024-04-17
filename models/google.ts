import new_error from "../lib/error";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import crypto from "node:crypto";

const google: LLMHost = {
  model_role: "model",
  system_role: "user",

  text: async (
    run_id: string,
    client: GoogleGenerativeAI,
    stream: StreamFunc,
    inputs: LLMFunctionBaseInputs,
  ): Promise<LLMTextResponse> => {
    const model_inputs: {
      model: string;
      systemInstruction?: Record<string, any>;
      generationConfig: Record<string, any>;
    } = {
      model: inputs.model,
      generationConfig: inputs.options,
    };

    if (
      inputs.messages.length > 1
      && 
      google.helpers.modelsWithInstructions().indexOf(inputs.model) !== -1
    ) {
      model_inputs.systemInstruction = {
        role: "system",
        parts: [{ text: inputs.messages[0].content }],
      };
      inputs.messages = inputs.messages.slice(1);
    }

    const model = client.getGenerativeModel({
      ...(model_inputs as any),
      tools: [
        { functionDeclarations: inputs.tools.map((tool) => tool.function) },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: "MODE_UNSPECIFIED",
        },
      },
    });

    let history = google.helpers.setupHistory(inputs);
    let input: string | Part[];

    if (inputs.messages[inputs.messages.length - 1].role === "user") {
      input = inputs.messages[inputs.messages.length - 1].content;
    } else {
      input = [ history[history.length - 1].parts[0] ];
      history = history.slice(0, history.length - 1);
    }

    const chat = model.startChat({
      history: history,
      generationConfig: model_inputs.generationConfig,
    });

    const response = await chat.sendMessageStream(
      input
    );

    let response_message = "";
    let tool_calls: LLMToolCall[] = [];
    let calls_messages: any[] = [];

    for await (const chunk of response.stream) {
      const text = chunk.text();
      if (text) {
        response_message += text;
        stream({ content: text, run_id });
      }

      const calls = chunk.functionCalls();
      if (calls) {
        calls_messages = calls;
        tool_calls = calls.map((call) => ({
          id: String(crypto.randomUUID()),
          type: "function",
          function: {
            name: String(call.name),
            arguments: JSON.stringify(call.args),
          },
        }));
      }
    }

    const follow_up_history = [{
      role: "model",
      follow_up: true,
      parts: calls_messages.map(call => ({functionCall: call}))
    }];

    return {
      type: "text",
      content: response_message,
      tool_calls,
      follow_up_history
    };
  },

  json: async (
    client: GoogleGenerativeAI,
    inputs: LLMFunctionBaseInputs,
    schema: ToolParameters,
  ): Promise<LLMJsonResponse> => {
    const tool: Tool = {
      type: "function",
      function: {
        name: "add_to_database",
        description: "Add data to a database",
        parameters: {
          ...schema
        }
      }
    };

    const model = client.getGenerativeModel({
      model: inputs.model,
      generationConfig: {
        temperature: 0,
      },
      tools: [{functionDeclarations: [tool.function as any]}],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY" as any,
          allowedFunctionNames: ["add_to_database"]
        }
      }
    });

    const response = await model.generateContent(
      `Extract data from the information below and add it to the database:\nInformation: ${inputs.messages[inputs.messages.length - 1].content}`,
    );

    const calls = response.response.functionCalls();

    if (!calls || calls.length < 1) {
      throw new Error(
        new_error(
          "Invalid LLM Response",
          "Expected LLM to return a JSON schema",
          "Json mode",
        ),
      );
    }

    const call = calls[0];
    const data = call?.args || {};

    return {
      type: "object",
      content: data,
    };
  },

  image: async (_client, _inputs: LLMFunctionImageInputs) => {
    throw new Error(
      new_error(
        "image_generation_not_available",
        "image generation using google clients is not available",
        "image generation",
      ),
    );
  },

  helpers: {

    modelsWithInstructions: () => ([
      "gemini-1.5-pro-latest"
    ]),

    setupHistory: (inputs: LLMFunctionBaseInputs) => {
      let slice = [];

      if (inputs.messages[inputs.messages.length-1].role === "user") {
        slice = inputs.messages.slice(0, inputs.messages.length - 1);
      }else {
        slice = inputs.messages;
      }

      const history = slice.slice().map((message) => {

        if (message.follow_up) {
          delete message.follow_up;
          return message;
        }

        if (message.role === "assistant" || message.role === "user") {
          return {
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          };
        }

        if (message.role === "tool") {
          return {
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: message.name,
                  response: {
                    name: message.name,
                    content: JSON.parse(message.content),
                  },
                },
              },
            ],
          };
        }

        return {
          role: "user",
          parts: [{ text: message.content }],
        };
      });

      return history;
    },
  },
};

export default google;
