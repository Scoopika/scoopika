interface StoreSession {
  id: string;
  user_name: string;
}

interface ContentHistory {
  role: "system" | "user" | "assistant" | "model";
  follow_up?: boolean;
  name?: string;
  content: string;
}

interface ToolHistory {
  role: "tool";
  tool_call_id: string;
  name: string;
  follow_up?: boolean;
  content: string;
}

interface ToolCallHistory {
  role: "call";
  name: string;
  follow_up?: boolean;
  args: string;
}

type LLMHistory = ContentHistory | ToolHistory;
