import {
  DeleteSessionRequest,
  GetRunRequest,
  GetSessionRequest,
  GetSessionRunsRequest,
  ListUserSessionsRequest,
  NewSessionRequest,
  RunHistory,
  StoreSession,
} from "@scoopika/types";
import { Client } from "./client";

export class Store {
  client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async getSession(id: string, allow_new?: boolean) {
    let response: string = "";
    const onMessage = (s: string) => {
      response += s;
    };

    const req: GetSessionRequest = {
      type: "get_session",
      payload: { id, allow_new },
    };

    await this.client.request(req, onMessage);
    const session = this.client.readResponse<StoreSession>(response);

    return session;
  }

  async deleteSession(id: string) {
    let response: string = "";
    const onMessage = (s: string) => {
      response += s;
    };

    const req: DeleteSessionRequest = {
      type: "delete_session",
      payload: { id },
    };

    await this.client.request(req, onMessage);
    const result = this.client.readResponse<boolean>(response);

    return result;
  }

  async newSession(
    data: {
      id?: string;
      user_id?: string;
      user_name?: string;
    } = {},
  ) {
    let response: string = "";
    const onMessage = (s: string) => (response += s);

    const req: NewSessionRequest = {
      type: "new_session",
      payload: data || {},
    };

    await this.client.request(req, onMessage);
    const session = this.client.readResponse<StoreSession>(response);
    console.log(session);

    return session;
  }

  async listUserSessions(user_id: string) {
    let response: string = "";
    const onMessage = (s: string) => (response += s);

    const req: ListUserSessionsRequest = {
      type: "list_user_sessions",
      payload: {
        id: user_id,
      },
    };

    await this.client.request(req, onMessage);
    const sessions = this.client.readResponse<string[]>(response);

    return sessions;
  }

  async getSessionMessages(session_id: string) {
    let response: string = "";
    const onMessage = (s: string) => (response += s);

    const req: GetSessionRunsRequest = {
      type: "get_session_runs",
      payload: {
        id: session_id,
      },
    };

    await this.client.request(req, onMessage);
    const runs = this.client.readResponse<RunHistory[]>(response);

    return runs;
  }

  async getSessionRuns(session_id: string) {
    let response: string = "";
    const onMessage = (s: string) => (response += s);

    const req: GetSessionRunsRequest = {
      type: "get_session_runs",
      payload: {
        id: session_id,
      },
    };

    await this.client.request(req, onMessage);
    const runs = this.client.readResponse<RunHistory[]>(response);

    return runs;
  }
}
