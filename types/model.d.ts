/*
 LLM Clients, responses, are also meant for image generation models,
 so the concept "LLM" means any model that can be run with a prompt somehow. 
*/

interface LLMResponseFormat {
  type: "json_object";
  schema: ToolParameters;
}

interface LLMCompletionBaseInputs {
  model: string;
  messages: LLMHistory[];
  response_format?: LLMResponseFormat;
  tools?: Tool[];
  tool_choice?: string;
  options?: Record<string, any>;
}

interface LLMCompletionToolsInputs extends LLMCompletionBaseInputs {
  tools: Tool[];
}

type LLMCompletionInputs = LLMCompletionBaseInputs | LLMCompletionToolsInputs;

interface LLMFunctionBaseInputs {
  model: string;
  tools: Tool[];
  messages: LLMHistory[];
  tool_choice?: string;
  response_format?: {
    type: "json_object";
    schema: ToolParameters;
  };
  options: Record<string, any>;
}

interface LLMFunctionImageInputs {
  model: string;
  prompt: string;
  n: number;
  size?: ImageSize;
}

interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface LLMTextResponse {
  type: "text";
  content: string;
  tool_calls?: LLMToolCall[];
  follow_up_history?: any[];
}

interface LLMImageResponse {
  type: "image";
  content: string[];
}

interface LLMJsonResponse {
  type: "object";
  content: Record<string, any>;
}

type LLMResponse = LLMTextResponse | LLMImageResponse | LLMJsonResponse;

const OpenAI = require("openai").OpenAI;
const Google = require("@google/generative-ai").GenerativeGoogleAI;

interface OpenAIClient {
  host: "openai";
  client: OpenAI;
}

interface GoogleClient {
  host: "google";
  client: Google;
}

type LLMClient = OpenAIClient | GoogleClient;

interface LLMHost {
  helpers: Record<string, Function>;
  model_role: "assistant" | "model";
  system_role: "user" | "system";
  text: (
    run_id: string,
    client,
    stream: StreamFunc,
    inputs: LLMFunctionBaseInputs,
  ) => Promise<LLMTextResponse>;
  image: (client, inputs: LLMFunctionImageInputs) => Promise<LLMResponse>;
  json: (
    client,
    inputs: LLMFunctionBaseInputs,
    schema: ToolParameters,
  ) => Promise<LLMJsonResponse>;
}
