interface StoreSession {
  id: string;
  user_name: string;
}

interface ContentHistory {
  role: "system" | "user" | "assistant" | "model";
  name?: string;
  content: string;
}

interface ToolHistory {
  role: "tool";
  tool_call_id: string;
  name: string;
  content: string;
}

type LLMHistory = ContentHistory | ToolHistory;
