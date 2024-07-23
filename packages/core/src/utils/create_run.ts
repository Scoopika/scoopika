import {
  ModelRunHistory,
  ModelTextDataResponse,
  RunInputs,
  UserRunHistory,
} from "@scoopika/types";

export function createUserRun(
  session_id: string,
  run_id: string,
  request: RunInputs,
  resolved_message: string,
): UserRunHistory {
  return {
    at: Date.now(),
    run_id,
    session_id,
    role: "user",
    request,
    resolved_message,
  };
}

export function createModelRun(
  session_id: string,
  run_id: string,
  response: ModelTextDataResponse,
): ModelRunHistory {
  return {
    at: Date.now(),
    role: "model",
    run_id,
    session_id,
    response,
  };
}
