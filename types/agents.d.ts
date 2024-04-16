interface AgentData {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  chained: boolean;
  prompts: Array<Prompt>;
  tools: Tool[];
}

interface StreamMessage {
  final?: boolean;
  run_id: string;
  content: string;
}

type StreamFunc = (stream: StreamMessage) => undefined;
type StatusUpdateFunc = (status: string) => undefined;
