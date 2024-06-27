import * as types from "@scoopika/types";
import Agent from "@/agent";
import Box from "@/box";
import Scoopika from "@/scoopika";
import serverHooks from "./server_hooks";
import setupAgents, { SetupAgentsFunc } from "../setup_agents";
import setupBoxes, { SetupBoxesFunc } from "../setup_boxes";

type Stream = (s: string) => any;

type Mappings = {
  [K in types.ServerRequest["type"]]: (
    s: Stream,
    payload: Extract<types.ServerRequest, { type: K }>["payload"],
  ) => any;
};

class Endpoint {
  private scoopika: Scoopika;
  setupAgents?: SetupAgentsFunc;
  setupBoxes?: SetupBoxesFunc;
  onRequest?: (req: types.ServerRequest) => any;
  private caching: boolean;
  private latest_setup: number = 0;
  private agents: Agent[] = [];
  private boxes: Box[] = [];
  private caching_limit: number = 1000000;

  constructor({
    scoopika,
    agents,
    boxes,
    onRequest,
    caching,
    caching_limit,
  }: {
    scoopika: Scoopika;
    agents?: SetupAgentsFunc | string[];
    boxes?: SetupBoxesFunc | string[];
    onRequest?: (req: types.ServerRequest) => any;
    caching?: boolean;
    caching_limit?: number;
  }) {
    this.scoopika = scoopika;
    this.setupAgents = setupAgents(agents || []);
    this.setupBoxes = setupBoxes(boxes || []);
    this.onRequest = onRequest;

    if (typeof caching_limit === "number") {
      this.caching_limit = caching_limit;
    }

    if (typeof caching !== "boolean") {
      caching = true;
    }

    this.caching = caching;
  }

  private getAgent(id: string): Agent {
    const agent = this.agents.filter((a) => a.id === id)[0];

    if (!agent) {
      throw new Error(
        `Agent with ID '${id}' is not found in Scoopika container`,
      );
    }

    return agent;
  }

  private getBox(id: string): Box {
    const box = this.boxes.filter((b) => b.id === id)[0];

    if (!box) {
      throw new Error(`Box with ID '${id}' is not found in Scoopika container`);
    }

    return box;
  }

  public async handleRequest(full_request: {
    request: Record<string, any> | unknown;
    stream: (s: string) => any;
    end?: () => any;
  }) {
    try {
      await this.setup();
      const request = full_request.request as types.ServerRequest;

      if (this.onRequest) {
        this.onRequest(request);
      }

      if (!request.type || !request.payload) {
        throw new Error(
          "Invalid request. make sure you're using the latest version of @scoopika/client and @scoopika/scoopika",
        );
      }

      const action = this.handlers[request.type];

      if (!action) {
        throw new Error(
          `Invalid action type: ${request.type}. make sure you have the latest version of @scoopika/client and @scoopika/scoopika`,
        );
      }

      await action(full_request.stream, request.payload as any);
    } catch (err: any) {
      console.error(err);
    } finally {
      if (full_request.end) {
        await full_request.end();
      }
    }
  }

  private async setup() {
    if (
      this.latest_setup !== 0 &&
      this.caching &&
      Date.now() - this.latest_setup <= this.caching_limit
    ) {
      return;
    }

    if (this.setupAgents) {
      this.agents = await this.setupAgents(this.scoopika);
    }

    if (this.setupBoxes) {
      this.boxes = await this.setupBoxes(this.scoopika);
    }
  }

  private async getSession(
    stream: (s: string) => any,
    payload: types.GetSessionRequest["payload"],
  ) {
    const session = await this.scoopika.getSession(
      payload.id,
      payload.allow_new,
    );
    await stream(this.streamMessage(session));
  }

  private async handleAgentRun(
    stream: Stream,
    payload: types.RunAgentRequest["payload"],
  ) {
    const agent = this.getAgent(payload.id);

    await agent.run({
      inputs: payload.inputs,
      options: payload.options,
      hooks: serverHooks(payload.hooks, stream),
    });
  }

  private async generateJSON(
    stream: Stream,
    payload: types.GenerateJSONRequest["payload"],
  ) {
    const agent = this.getAgent(payload.id);

    const data = await agent.generateJSON(payload);
    const message = this.streamMessage(data);
    await stream(message);
  }

  private async handleBoxRun(
    stream: Stream,
    payload: types.RunBoxRequest["payload"],
  ) {
    const box = this.getBox(payload.id);

    await box.run({
      inputs: payload.inputs,
      options: payload.options,
      hooks: serverHooks(payload.hooks, stream),
    });
  }

  private async loadAgent(
    stream: Stream,
    payload: types.LoadAgentRequest["payload"],
  ) {
    const agent = await this.getAgent(payload.id).load();
    const message = this.streamMessage(agent.agent);
    await stream(message);
  }

  private async loadBox(
    stream: Stream,
    payload: types.LoadBoxRequest["payload"],
  ) {
    const box = await this.getBox(payload.id).load();
    const message = this.streamMessage(box.box);
    await stream(message);
  }

  private async readAudio(
    stream: Stream,
    payload: types.ReadAudioRequest["payload"],
  ) {
    // REMOVE THIS LATER ;)
  }

  private async newSession(
    stream: Stream,
    payload: types.NewSessionRequest["payload"],
  ) {
    const session = await this.scoopika.newSession(payload);
    await stream(this.streamMessage(session));
  }

  private async deleteSession(
    stream: Stream,
    payload: types.DeleteSessionRequest["payload"],
  ) {
    await this.scoopika.deleteSession(payload.id);
    await stream(this.streamMessage({ success: true }));
  }

  private async listUserSessions(
    stream: Stream,
    payload: types.ListUserSessionsRequest["payload"],
  ) {
    const sessions = await this.scoopika.listUserSessions(payload.id);
    await stream(
      this.streamMessage({
        sessions,
      }),
    );
  }

  private async getSessionRuns(
    stream: Stream,
    payload: types.GetSessionRunsRequest["payload"],
  ) {
    const runs = await this.scoopika.getSessionMessages(payload.id);
    await stream(this.streamMessage({ runs }));
  }

  private async getRun(
    stream: Stream,
    payload: types.GetRunRequest["payload"],
  ) {
    const run = await this.scoopika.getRun(
      payload.session,
      payload.run_id,
      payload.role,
    );

    await stream(this.streamMessage({ run }));
  }

  private streamMessage(data: any) {
    if (typeof data === "object") {
      data = JSON.stringify({ ...data });
    }

    return `<SCOOPSTREAM>${data}</SCOOPSTREAM>`;
  }

  handlers: Mappings = {
    load_agent: this.loadAgent.bind(this),
    load_box: this.loadBox.bind(this),
    run_agent: this.handleAgentRun.bind(this),
    run_box: this.handleBoxRun.bind(this),
    get_session: this.getSession.bind(this),
    new_session: this.newSession.bind(this),
    delete_session: this.deleteSession.bind(this),
    list_user_sessions: this.listUserSessions.bind(this),
    get_session_runs: this.getSessionRuns.bind(this),
    get_run: this.getRun.bind(this),
    read_audio: this.readAudio.bind(this),
    generate_json: this.generateJSON.bind(this),
  };
}

export default Endpoint;
