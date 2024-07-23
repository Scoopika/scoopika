import * as types from "@scoopika/types";
import { OpenAI } from "openai";
import { buildMessageFromRun } from "../utils";
import crypto from "node:crypto";

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export class OpenAILLM
  implements
    types.LLM<
      OpenAI,
      types.Message,
      types.LLMOptions,
      OpenAITool,
      types.ToolMessage
    >
{
  client: OpenAI | null = null;
  vision_models: string[] = [];
  model: string | null = null;

  init(client: OpenAI, model: string) {
    this.client = client;
    this.model = model;
  }

  checkInit() {
    const client = this.client;
    const model = this.model;

    if (!client || !model) {
      throw new Error(
        "The LLM hasn't been initialized yet! call `.init` with the provider client and model name",
      );
    }

    return { client, model };
  }

  tool(t: types.Tool) {
    const tool: OpenAITool = {
      type: "function",
      function: {
        ...t.function,
        parameters: t.function.parameters as Record<string, unknown>,
      },
    };

    return tool;
  }

  options(o: types.LLMOptions, t: OpenAITool[]) {
    const options: types.LLMOptions = {
      temperature: o.temperature,
      max_tokens: o.max_tokens ?? 500,
      tool_choice: t.length < 1 ? undefined : o.tool_choice ?? "auto",
    };

    return options;
  }

  toolResult(res: types.ToolMessage): types.ToolMessage {
    return {
      ...res,
      content: `Tool results:\n${res.content}`,
    };
  }

  message(run: types.RunHistory) {
    if (run.role === "model") {
      const content: types.LLMMessage = {
        role: "assistant",
        content: run.response.content,
      };

      const calls: types.ToolMessage[] = run.response.tool_calls.map(
        (call) => ({
          role: "tool",
          name: call.call.function.name,
          tool_call_id: call.call.id,
          content: call.result,
        }),
      );

      return [...calls, content];
    }

    const vision = this.vision_models.indexOf(this.model || "NONE") !== -1;
    const message = buildMessageFromRun({
      ...run,
      request: { ...run.request, message: run.resolved_message },
    });

    if (typeof message !== "string") {
      const used_images = message.filter((m) => m.type === "image_url");

      if (used_images.length > 0 && !vision) {
        throw new Error(
          "Sending images input to a LLM that doesn't support vision",
        );
      }
    }

    const res: types.UserMessage = { role: "user", content: message };
    return [res];
  }

  buildMessages(inputs: types.LLMTextInputs | types.LLMObjectInputs) {
    const messages: types.Message[] = [];
    messages.push({ role: "system", content: inputs.system_prompt });

    for (const msg of inputs.messages.sort((a, b) => a.at - b.at)) {
      messages.push(...this.message(msg));
    }

    messages.push(inputs.prompt);

    return messages;
  }

  async generateText(
    inputs: types.LLMTextInputs,
    hooksHub: types.HooksHub,
  ): Promise<types.LLMTextResponse> {
    const { client: openai, model } = this.checkInit();

    const messages = this.buildMessages(inputs);
    const tools = (inputs.tools || []).map((t) => this.tool(t));
    const options = this.options(inputs.options || {}, tools);
    const tools_results = (inputs.tools_results || []).map((tr) =>
      this.toolResult(tr),
    );
    messages.push(...tools_results);

    let content: string = "";
    let tool_calls: types.LLMToolCall[] = [];

    const response = await openai.chat.completions.create({
      ...options,
      model,
      messages,
      stream: true,
      tools,
      tool_choice: tools.length > 0 ? "auto" : undefined,
    });

    for await (const chunk of response) {
      if (chunk.choices[0].delta.content) {
        content += chunk.choices[0].delta.content;
        const stream: types.StreamMessage = {
          type: "text",
          content: chunk.choices[0].delta.content,
        };

        hooksHub.executeHook("onStream", stream);
        hooksHub.executeHook("onOutput", stream);
        hooksHub.executeHook("onToken", chunk.choices[0].delta.content);
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

    if (tool_calls.length < 1 && content.length > 0) {
      hooksHub.executeHook("onStream", {
        final: true,
        content: "",
        type: "text",
      });
      hooksHub.executeHook("onOutput", {
        final: true,
        content: "",
        type: "text",
      });
    }

    return {
      content,
      tool_calls,
    };
  }

  async generateObject(
    inputs: types.LLMObjectInputs,
    _hooksHub: types.HooksHub,
  ) {
    const { client: openai, model } = this.checkInit();

    const messages = this.buildMessages(inputs);
    const options = this.options(inputs.options || {}, []);

    const response = await openai.chat.completions.create({
      ...options,
      messages,
      model,
      response_format: !this.model?.includes("fireworks")
        ? { type: "json_object" }
        : ({ type: "json_object", schema: inputs.schema } as any),
      stream: false,
    });

    return response.choices[0].message.content ?? "{}";
  }
}
