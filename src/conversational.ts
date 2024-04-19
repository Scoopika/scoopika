// import new_error from "./lib/error";
//
// class Conversation {
//
//   session: StoreSession;
//   agent: AgentData;
//   clients: LLMClient[];
//   stream: StreamFunc;
//
//   constructor ({
//     session, agent, clients, stream
//   }: {
//     session: StoreSession;
//     agent: AgentData;
//     clients: LLMClient[];
//     stream: StreamFunc;
//   }) {
//     this.session = session;
//     this.agent = agent;
//     this.clients = clients;
//     this.stream = stream;
//   }
//
//   async run({
//     run_id, inputs, history
//   }: {
//     run_id: string;
//     inputs: Inputs;
//     history: LLMHistory[];
//   }): Promise<AgentInnerRunResult> {
//
//     if (!inputs.message) {
//       throw new Error(new_error(
//         "invalid_inputs",
//         "The inputs has no 'message'. make sure you're sending a valid message to the agent",
//         "Conversational run"
//       ))
//     }
//
//
//
//   }
//
// }
//
// export default Conversation;
