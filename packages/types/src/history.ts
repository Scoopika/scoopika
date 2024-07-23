import { RunInputs } from "./inputs";
import { ModelTextDataResponse, ModelTextResponse } from "./response";

export interface StoreSession {
  id: string;
  user_id?: string;
  title?: string;
}

export interface UserRunHistory {
  at: number;
  role: "user";
  user_id?: string;
  run_id: string;
  session_id: string;
  request: RunInputs;
  resolved_message: string;
}

export interface ModelRunHistory {
  at: number;
  role: "model";
  run_id: string;
  session_id: string;
  response: ModelTextDataResponse;
}

export type RunHistory = UserRunHistory | ModelRunHistory;

export interface Store {
  newSession: (data: {
    id?: string;
    user_id?: string;
  }) => Promise<StoreSession>;

  getSession: (id: string) => Promise<StoreSession | undefined>;
  deleteSession: (id: string) => Promise<void>;
  getUserSessions: (user_id: string) => Promise<string[]>;

  pushRun: (session: StoreSession | string, run: RunHistory) => Promise<void>;
  batchPushRuns: (
    session: StoreSession | string,
    runs: RunHistory[],
  ) => Promise<void>;
  getRuns: (session: StoreSession | string) => Promise<RunHistory[]>;
  getMessages: (session: StoreSession | string) => Promise<RunHistory[]>;
}
