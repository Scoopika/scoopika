import { HooksHub } from "./stream_hooks";
import { Tool } from "./tools";
import {
  LLMObjectInputs,
  LLMOptions,
  LLMTextInputs,
  ToolMessage,
} from "./inputs";
import { LLMTextResponse } from "./response";
import { RunHistory } from "./history";

export type MainProvidersType = "openai" | "anthropic";
export type ProvidersName =
  | "openai"
  // | "anthropic"
  | "fireworks"
  | "groq"
  | "together";

export type OpenAIModels = string & (
  | "gpt-3.5-turbo"
  | "gpt-4o"
  | "gpt-4-turbo"
  | "gpt-4"
  | "got-4-turbo-preview");
export type FireWorksModels = string & ("accounts/fireworks/models/firefunction-v2");
export type GroqModels = string & (
  | "llama3-70b-8192"
  | "llama3-8b-8192"
  | "llama-3.1-70b-versatile"
  | "llama-3.1-8b-instant"
  | "gemma2-9b-it"
  | "gemma-7b-it");
export type TogetherModels = string & (
  | "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"
  | "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"
  | "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo"
  | "meta-llama/Meta-Llama-3-70B-Instruct-Turbo"
  | "mistralai/Mixtral-8x7B-Instruct-v0.1"
  | "mistralai/Mistral-7B-Instruct-v0.1");

export type Voice = "aura-luna-en" | "aura-orpheus-en";

export type AgentModelConfig =
  | { provider: "openai"; model: OpenAIModels; prompt: string; knowledge?: string; memory?: string, voice?: Voice }
  | { provider: "fireworks"; model: FireWorksModels; prompt: string; knowledge?: string; memory?: string, voice?: Voice}
  | { provider: "groq"; model: GroqModels; prompt: string; knowledge?: string; memory?: string, voice?: Voice }
  | { provider: "together"; model: TogetherModels; prompt: string; knowledge?: string; memory?: string, voice?: Voice  };

export interface SavedProvider {
  type: MainProvidersType;
  name: string;
  apiKey?: string;
  baseURL?: string;
}

export interface LLM<CLIENT, M, O, T, TR> {
  client: CLIENT | null;
  vision_models?: string[];
  model: string | null;

  message(run: RunHistory): M[];
  options(opt: LLMOptions, tools: T[]): O;
  tool(tool: Tool): T;
  toolResult(res: ToolMessage): TR;

  init(client: CLIENT, name: string, model: string): void;
  checkInit(): { client: CLIENT; model: string };

  generateText(
    inputs: LLMTextInputs,
    hooksHub: HooksHub,
  ): Promise<LLMTextResponse>;

  generateObject(inputs: LLMObjectInputs, hooksHub: HooksHub): Promise<string>;
}
