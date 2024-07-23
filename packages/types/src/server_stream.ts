import { AgentData } from "./agents";
import { ModelTextResponse, VoiceResponse } from "./response";
import { StreamMessage } from "./stream_hooks";
import { LLMToolCall } from "./tools";

export interface ServerBaseStream {
  type: "stream";
  data: StreamMessage;
}

export interface ServerStartStream {
  type: "start";
  data: {
    run_id: string;
    session_id: string;
  };
}

export interface ServerTokenStream {
  type: "token";
  data: string;
}

export interface ServerResponseStream {
  type: "response";
  data: AgentData;
}

export interface ServerToolCallStream {
  type: "tool_call";
  data: LLMToolCall;
}

export interface ServerToolResStream {
  type: "tool_result";
  data: {
    call: LLMToolCall;
    result: any;
  };
}

export interface ServerAgentResponseStream {
  type: "agent_response";
  data: {
    name: string;
    response: ModelTextResponse;
  };
}

export interface ServerEndStream {
  type: "end";
  data: any;
}

export interface ServerClientActionStream {
  type: "client_action";
  data: {
    id: string;
    tool_name: string;
    arguments: Record<string, any>;
  };
}

export interface ServerAudioStream {
  type: "audio";
  data: VoiceResponse;
}

export interface GeneratedJSONStream {
  type: "generated_json";
  data: Record<string, any>;
}

export type ServerStream =
  | ServerBaseStream
  | ServerStartStream
  | ServerTokenStream
  | ServerResponseStream
  | ServerToolCallStream
  | ServerToolResStream
  | ServerAgentResponseStream
  | ServerEndStream
  | ServerClientActionStream
  | ServerAudioStream
  | GeneratedJSONStream;
