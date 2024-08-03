// import * as types from "@scoopika/types";
// import { Agent, DynamicBlock } from "../blocks";
// import { Scoopika } from "../scoopika";
// import serverHooks from "./server_hooks";
// import setupAgents, { SetupAgentsFunc } from "./setup_agents";
// import { readError } from "../utils";
// import { Model } from "../model";
//
// type Stream = (s: string) => any;
//
// type Mappings = {
//   [K in types.ServerRequest["type"]]: (
//     s: Stream,
//     payload: Extract<types.ServerRequest, { type: K }>["payload"],
//   ) => any;
// };
//
// export class Endpoint {
//   private scoopika: Scoopika;
//   setupAgents?: SetupAgentsFunc;
//   onRequest?: (req: types.ServerRequest) => any;
//   private caching: boolean;
//   private latest_setup: number = 0;
//   private agents: Agent[] = [];
//   private caching_limit: number = 1000000;
//   private memory: types.Store;
//   private blocks: DynamicBlock<any, any, any, any>[] = [];
//
//   constructor({
//     scoopika,
//     agents,
//     onRequest,
//     caching,
//     caching_limit,
//     blocks,
//   }: {
//     scoopika: Scoopika;
//     agents?: SetupAgentsFunc | string[];
//     onRequest?: (req: types.ServerRequest) => any;
//     caching?: boolean;
//     caching_limit?: number;
//     blocks?: DynamicBlock<any, any, any, any>[];
//   }) {
//     this.scoopika = scoopika;
//     this.memory = scoopika.memory;
//     this.setupAgents = setupAgents(agents || [], this.memory);
//     this.onRequest = onRequest;
//
//     if (blocks) {
//       this.blocks = blocks;
//     }
//
//     if (typeof caching_limit === "number") {
//       this.caching_limit = caching_limit;
//     }
//
//     if (typeof caching !== "boolean") caching = true;
//     this.caching = caching;
//   }
//
//   private getAgent(id: string): Agent {
//     const agent = this.agents.filter((a) => a.id === id)[0];
//
//     if (!agent) {
//       throw new Error(
//         `Agent with ID '${id}' is not found in Scoopika container`,
//       );
//     }
//
//     return agent;
//   }
//
//   public async handleRequest(full_request: {
//     request: Record<string, any> | unknown;
//     stream: (s: string) => any;
//     end?: () => any;
//   }) {
//     try {
//       await this.setup();
//       const request = full_request.request as types.ServerRequest;
//
//       if (this.onRequest) {
//         this.onRequest(request);
//       }
//
//       if (!request.type || !request.payload) {
//         throw new Error(
//           "Invalid request. make sure you're using the latest version of @scoopika/client and @scoopika/scoopika",
//         );
//       }
//
//       const action = this.handlers[request.type];
//
//       if (!action) {
//         throw new Error(
//           `Invalid action type: ${request.type}. make sure you have the latest version of @scoopika/client and @scoopika/scoopika`,
//         );
//       }
//
//       await action(full_request.stream, request.payload as any);
//     } catch (err: any) {
//       console.error(err);
//       await full_request.stream(this.streamMessage(null, readError(err)));
//     } finally {
//       if (full_request.end) await full_request.end();
//     }
//   }
//
//   private async setup() {
//     if (
//       this.latest_setup !== 0 &&
//       this.caching &&
//       Date.now() - this.latest_setup <= this.caching_limit
//     ) {
//       return;
//     }
//
//     if (this.setupAgents) {
//       this.agents = await this.setupAgents(this.scoopika);
//     }
//   }
//
//   private async getSession(
//     stream: (s: string) => any,
//     payload: types.GetSessionRequest["payload"],
//   ) {
//     const session = await this.memory.getSession(payload.id);
//     await stream(this.streamMessage(session));
//   }
//
//   private async handleAgentRun(
//     stream: Stream,
//     payload: types.RunAgentRequest["payload"],
//   ) {
//     const agent = this.getAgent(payload.id);
//
//     await agent.run({
//       inputs: payload.inputs,
//       options: payload.options,
//       hooks: serverHooks(payload.hooks, stream),
//     });
//   }
//
//   private async handleAgentJson(
//     stream: Stream,
//     payload: types.AgentGenerateJSONRequest["payload"],
//   ) {
//     const agent = this.getAgent(payload.id);
//
//     const { data, error } = await agent.generateObjectWithSchema({
//       ...payload,
//     });
//
//     const msg = this.streamMessage(data, error);
//     await stream(msg);
//   }
//
//   private async generateJSON(
//     stream: Stream,
//     payload: types.GenerateJSONRequest["payload"],
//   ) {
//     const model = new Model({
//       scoopika: this.scoopika,
//       provider: payload.provider,
//       model: payload.model,
//     });
//
//     const { data, error } = await model.generateObjectWithSchema({
//       ...payload,
//     });
//
//     const msg = this.streamMessage(data, error);
//     await stream(msg);
//   }
//
//   private async loadAgent(
//     stream: Stream,
//     payload: types.LoadAgentRequest["payload"],
//   ) {
//     const agent = await this.getAgent(payload.id).load();
//     const message = this.streamMessage(agent);
//     await stream(message);
//   }
//
//   private async newSession(
//     stream: Stream,
//     payload: types.NewSessionRequest["payload"],
//   ) {
//     const session = await this.memory.newSession(payload);
//     const msg = this.streamMessage(session);
//     await stream(msg);
//   }
//
//   private async deleteSession(
//     stream: Stream,
//     payload: types.DeleteSessionRequest["payload"],
//   ) {
//     await this.memory.deleteSession(payload.id);
//     await stream(this.streamMessage(true));
//   }
//
//   private async listUserSessions(
//     stream: Stream,
//     payload: types.ListUserSessionsRequest["payload"],
//   ) {
//     const sessions = await this.memory.getUserSessions(payload.id);
//     await stream(this.streamMessage(sessions));
//   }
//
//   private async getSessionRuns(
//     stream: Stream,
//     payload: types.GetSessionRunsRequest["payload"],
//   ) {
//     const runs = await this.memory.getRuns(payload.id);
//     await stream(this.streamMessage(runs));
//   }
//
//   private async customRequest(
//     stream: Stream,
//     payload: types.CustomBlockRequest<any, any>["payload"],
//   ) {
//     const block = this.blocks.filter((b) => b.name === payload.id)[0];
//
//     if (!block) {
//       const available = this.blocks.map((b) => b.name);
//       throw new Error(
//         `The block '${payload.id}' is not found.\navailable blocks: ${JSON.stringify(
//           available,
//           null,
//           4,
//         )}`,
//       );
//     }
//
//     const { data, error } = await block.run({
//       inputs: payload.inputs,
//       variables: payload.variables,
//       options: payload.options,
//     });
//
//     const msg = this.streamMessage(data, error);
//     await stream(msg);
//   }
//
//   async runModel(stream: Stream, payload: types.RunModelRequest["payload"]) {
//     const model = new Model({
//       scoopika: this.scoopika,
//       provider: payload.provider,
//       model: payload.model,
//     });
//     await model.generateText({
//       inputs: payload.inputs,
//       options: payload.options,
//       hooks: serverHooks(payload.hooks, stream),
//     });
//   }
//
//   private streamMessage(data: any, error: string | null = null) {
//     const msg = { data, error };
//     return `<SCOOPSTREAM>${JSON.stringify(msg)}</SCOOPSTREAM>`;
//   }
//
//   handlers: Mappings = {
//     load_agent: this.loadAgent.bind(this),
//     run_agent: this.handleAgentRun.bind(this),
//     get_session: this.getSession.bind(this),
//     new_session: this.newSession.bind(this),
//     delete_session: this.deleteSession.bind(this),
//     list_user_sessions: this.listUserSessions.bind(this),
//     get_session_runs: this.getSessionRuns.bind(this),
//     generate_json: this.generateJSON.bind(this),
//     run_block: this.customRequest.bind(this),
//     run_model: this.runModel.bind(this),
//     agent_generate_json: this.handleAgentJson.bind(this),
//   };
// }
