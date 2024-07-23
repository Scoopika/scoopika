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
  | "anthropic"
  | "fireworks"
  | "groq"
  | "together";

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
