interface AgentData {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  chained: boolean;
  prompts: Prompt[];
  timeout?: number;
  tools: ToolSchema[];
  wanted_responses?: string[];
}

interface StreamMessage {
  final?: boolean;
  run_id: string;
  content: string;
}

interface ToolCalledMessage {
  name: string;
  result: string;
}

type StreamFunc = (stream: StreamMessage) => undefined;
type StatusUpdateFunc = (status: string) => undefined;
type ToolCalledFunc = (data: ToolCalledMessage) => undefined;

interface StreamListener {
  type: "stream";
  func: StreamFunc;
}

interface StatusUpdateListener {
  type: "status";
  func: StatusUpdateFunc;
}

interface ToolCalledListener {
  type: "tool_call";
  func: ToolCalledFunc;
}

type OnListener = StreamListener | StatusUpdateListener | ToolCalledListener;
