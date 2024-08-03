import { JSONSchema } from "openai/lib/jsonschema";
import { RunInputs, RunOptions } from "./inputs";
import { Hooks } from "./stream_hooks";

export interface TextGenerationRequest {
  type: "run_agent";
  payload: {
    inputs: RunInputs;
    options?: RunOptions;
    hooks: Array<keyof Hooks>;
  };
}

export interface AgentJSONGenerationRequest {
  type: "agent_generate_json";
  payload: {
    inputs: RunInputs;
    options?: RunOptions;
    schema: JSONSchema;
    prompt?: string;
    max_tries?: number;
  };
}

export type AgentRequest = TextGenerationRequest | AgentJSONGenerationRequest;
