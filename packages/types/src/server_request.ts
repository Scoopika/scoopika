import { JSONSchema } from "openai/lib/jsonschema";
import { StoreSession } from "./history";
import { Hooks } from "./stream_hooks";
import { RunInputs, RunOptions } from "./inputs";
import { ProvidersName } from "./llms";

export interface LoadAgentRequest {
  type: "load_agent";
  payload: {
    id: string;
  };
}

export interface RunAgentRequest {
  type: "run_agent";
  payload: {
    id: string;
    inputs: RunInputs;
    options?: RunOptions;
    hooks: Array<keyof Hooks>;
  };
}

export interface GetSessionRequest {
  type: "get_session";
  payload: {
    id: string;
    allow_new?: boolean;
  };
}

export interface NewSessionRequest {
  type: "new_session";
  payload: {
    id?: string;
    user_name?: string;
    user_id?: string;
  };
}

export interface DeleteSessionRequest {
  type: "delete_session";
  payload: {
    id: string;
  };
}

export interface GetSessionRunsRequest {
  type: "get_session_runs";
  payload: {
    id: string;
  };
}

export interface ListUserSessionsRequest {
  type: "list_user_sessions";
  payload: {
    id: string;
  };
}

export interface GetRunRequest {
  type: "get_run";
  payload: {
    session: StoreSession | string;
    run_id: string;
    role?: "agent" | "user";
  };
}

export interface GenerateJSONRequest {
  type: "generate_json";
  payload: {
    inputs: RunInputs;
    options?: RunOptions;
    schema: JSONSchema;
    prompt?: string;
    provider: ProvidersName;
    model: string;
    max_tries?: number;
  };
}

export interface AgentGenerateJSONRequest {
  type: "agent_generate_json";
  payload: {
    id: string;
    inputs: RunInputs;
    options?: RunOptions;
    schema: JSONSchema;
    prompt?: string;
    max_tries?: number;
  };
}

export interface RunModelRequest {
  type: "run_model";
  payload: {
    provider: ProvidersName;
    model: string;
    inputs: RunInputs;
    options?: RunOptions;
    hooks: (keyof Hooks)[];
  };
}

export interface CustomBlockRequest<Inputs, Variables> {
  type: "run_block";
  payload: {
    id: string;
    inputs: Inputs;
    variables: Variables;
    options?: RunOptions;
  };
}

export type ServerRequest =
  | LoadAgentRequest
  | RunAgentRequest
  | GetSessionRequest
  | NewSessionRequest
  | DeleteSessionRequest
  | GetSessionRunsRequest
  | ListUserSessionsRequest
  | GenerateJSONRequest
  | RunModelRequest
  | AgentGenerateJSONRequest
  | CustomBlockRequest<any, any>;
