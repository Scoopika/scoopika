import { JSONSchema } from "openai/lib/jsonschema";
import { RunHistory } from "./history";
import { Tool, ToolSchema } from "./tools";

export interface RemoteAudio {
  type: "remote";
  path: string;
}

export interface Base64Audio {
  type: "base64";
  value: string;
}

export type Audio = RemoteAudio | Base64Audio;

export interface PdfFile {
  type: "pdf";
  path: string;
  remote: boolean;
}

export interface TxtFile {
  type: "txt";
  path: string;
  remote: boolean;
}

export type FileInput = PdfFile | TxtFile;

/**
 * Defines the inputs for a new LLM run.
 * At least one of the values should be set, otherwise an error wil be thrown
 * */
export interface RunInputs {
  message?: string;
  images?: string[];
  audio?: Audio[];
  urls?: string[];
  context?: {
    description: string;
    value: string;
    scope: "session" | "run";
  }[];
}

/**
 * Defines the options for a new LLM run.
 * Define a session id to have context-aware runs within a session.
 * Set save_history to `false` to disable saving the run to the memory (session history).
 * Set max_tools to the max number of tools the LLM can take in one run (default: 5).
 * Set voice to `true` to get a voice response along with the text response.
 *
 */
export interface RunOptions {
  session_id?: string;
  run_id?: string;
  save_history?: boolean;
  max_tools?: number;
  voice?: boolean;
  llm?: LLMOptions;
  tools?: ToolSchema[];
}

export type UserTextMessage = { type: "text"; text: string };

export interface UserImageContent {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type UserMessageContent = UserTextMessage | UserImageContent;

export interface UserMessage {
  role: "user";
  content: string | UserMessageContent[];
}

export interface LLMMessage {
  role: "assistant";
  content: string;
}

export interface ToolMessage {
  role: "tool";
  tool_call_id: string;
  name: string;
  follow_up?: boolean;
  content: string;
}

export interface SystemMessage {
  role: "system";
  content: string;
}

export type Message = UserMessage | LLMMessage | ToolMessage | SystemMessage;

export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  tool_choice?: ("none" | "auto" | "required") & string;
  top_p?: number;
  top_k?: number;
}

export interface LLMTextInputs {
  system_prompt: string;
  prompt: UserMessage;
  messages: RunHistory[];
  options?: LLMOptions;
  tools?: Tool[];
  tools_results?: ToolMessage[];
}

export interface LLMObjectInputs {
  system_prompt: string;
  prompt: UserMessage;
  messages: RunHistory[];
  options?: LLMOptions;
  schema: JSONSchema;
  maxRetries?: number;
}

export interface ModelTextInputs {
  run_id?: string;
  system_prompt?: string;
  inputs: RunInputs;
}

export interface ModelObjectInputs<SCHEMA> {
  run_id?: string;
  prompt?: string;
  inputs: RunInputs;
  schema: SCHEMA;
  options?: RunOptions;
  max_tries?: number;
}
