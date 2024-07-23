import { ModelTextResponse, VoiceResponse } from "./response";
import { LLMToolCall, ToolCall } from "./tools";
import { ServerClientActionStream } from "./server_stream";

type HookFunc<Data> = (data: Data) => any;

export interface StreamMessage {
  final?: boolean;
  type: "text";
  run_id?: string;
  content: string;
}

export interface Hooks {
  onStream?: HookFunc<StreamMessage>;
  onOutput?: HookFunc<StreamMessage>;
  onToken?: HookFunc<string>;
  onAudio?: HookFunc<VoiceResponse>;
  onFinish?: HookFunc<ModelTextResponse>;
  onStart?: HookFunc<{ run_id: string; session_id: string }>;
  onToolCall?: HookFunc<LLMToolCall>;
  onToolResult?: HookFunc<ToolCall>;
  onClientSideAction?: HookFunc<ServerClientActionStream["data"]>;
  onModelResponse?: HookFunc<ModelTextResponse>;
  onJson?: HookFunc<unknown>;
}

export type HookArrays = {
  [K in keyof Hooks]: Hooks[K][];
};

export interface HooksHub {
  hooks: HookArrays;

  addHook: <K extends keyof Hooks>(type: K, func: Hooks[K]) => void;
  addRunHooks: (hooks: Hooks) => void;

  executeHook: <K extends keyof Hooks>(
    key: K,
    data: Parameters<NonNullable<Hooks[K]>>[0],
  ) => Promise<void>;
}
