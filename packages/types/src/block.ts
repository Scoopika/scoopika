import { z } from "zod";
import { RunInputs, RunOptions } from "./inputs";
import { Hooks } from "./stream_hooks";

export interface DefaultBlockInputs {
  inputs: RunInputs;
  options?: RunOptions;
  hooks?: Hooks;
  variables?: Record<string, unknown>;
}

export interface DynamicBlockInputs<INPUTS, VARIABLES> {
  inputs: INPUTS;
  options?: RunOptions;
  hooks?: Hooks;
  variables?: VARIABLES;
}

export interface DynamicBlockObjectInputs<INPUTS, VARIABLES> {
  inputs: INPUTS;
  options?: RunOptions;
  hooks?: Hooks;
  variables?: VARIABLES;
  schema: z.ZodTypeAny;
}

export interface DynamicBlockMethodInputs<INPUTS, VARAIBLES> {
  inputs: INPUTS;
  options: RunOptions;
  hooks?: Hooks;
  variables: VARAIBLES;
}

export interface ValidBlockResponse<Response> {
  data: Response;
  error: null;
}

export interface FailedBlockResponse {
  data: null;
  error: string;
}

export type BlockResponse<Response> =
  | ValidBlockResponse<Response>
  | FailedBlockResponse;

export interface NewBlockSchema<
  Init extends z.ZodTypeAny = any,
  Inputs extends z.ZodTypeAny = any,
  Response extends z.ZodTypeAny = any,
  Variables extends z.ZodTypeAny = any,
> {
  init?: Init;
  inputs?: Inputs;
  response?: Response;
  variables?: Variables;
}
