import { LLMToolCall, ToolCall } from "./tools";

export interface VoiceResponse {
  index: number;
  run_id: string;
  audio_id: string;
  read: string;
}

export interface ModelTextDataResponse {
  run_id: string;
  session_id: string;
  content: string;
  audio: VoiceResponse[];
  tool_calls: ToolCall[];
}

export interface ModelErrorResponse {
  data: null;
  error: string;
}

export interface ValidTextModelResponse {
  data: ModelTextDataResponse;
  error: null;
}

export type ModelTextResponse = ModelErrorResponse | ValidTextModelResponse;

export interface LLMTextResponse {
  content: string;
  tool_calls: LLMToolCall[];
}

export interface LLMObjectResponse<T = unknown> {
  data: T;
}

export interface ModelObjectValidResponse<T> {
  data: T;
  error: null;
}

export type ModelObjectResponse<T> =
  | ModelErrorResponse
  | ModelObjectValidResponse<T>;
