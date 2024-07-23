import { RunInputs, UserRunHistory } from "@scoopika/types";

const setupRequest = (
  session_id: string,
  inputs: RunInputs,
  run_id?: string,
  user_id?: string,
) => {
  const req: UserRunHistory = {
    role: "user",
    at: Date.now(),
    session_id,
    run_id: run_id || crypto.randomUUID(),
    user_id,
    request: inputs,
    resolved_message: "PLACEHOLDER",
  };

  return req;
};

export default setupRequest;
