import {
  ServerBaseStream,
  ServerStartStream,
  ServerTokenStream,
  ServerResponseStream,
  ServerToolCallStream,
  ServerToolResStream,
  ServerAgentStream,
  ServerBoxResponseStream,
  ServerAgentResponseStream,
} from "@scoopika/types";
class StreamObject<Data> {
  data: Data;

  constructor(data: Data) {
    this.data = data;
  }

  string() {
    return JSON.stringify(this.data);
  }

  object() {
    return this.data;
  }
}

const serverStream = {
  baseStream: (data: ServerBaseStream["data"]) => {
    return new StreamObject<ServerBaseStream>({ type: "stream", data });
  },

  startStream: (data: ServerStartStream["data"]) => {
    return new StreamObject<ServerStartStream>({ type: "start", data });
  },

  tokenStream: (data: ServerTokenStream["data"]) => {
    return new StreamObject<ServerTokenStream>({ type: "token", data });
  },

  responseStream: (data: ServerResponseStream["data"]) => {
    return new StreamObject<ServerResponseStream>({ type: "response", data });
  },

  toolCallStream: (data: ServerToolCallStream["data"]) => {
    return new StreamObject<ServerToolCallStream>({ type: "tool_call", data });
  },

  toolResultStream: (data: ServerToolResStream["data"]) => {
    return new StreamObject<ServerToolResStream>({ type: "tool_result", data });
  },

  agentSelectedStream: (data: ServerAgentStream["data"]) => {
    return new StreamObject<ServerAgentStream>({ type: "select_agent", data });
  },

  agentResponseStream: (data: ServerAgentResponseStream["data"]) => {
    return new StreamObject<ServerAgentResponseStream>({
      type: "agent_response",
      data,
    });
  },

  boxResponseStream: (data: ServerBoxResponseStream["data"]) => {
    return new StreamObject<ServerBoxResponseStream>({
      type: "box_response",
      data,
    });
  },
};

export default serverStream;
