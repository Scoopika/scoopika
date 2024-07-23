import { InTool, ToolSchema } from "./tools";

export interface Prompt {
  id: string;
  index: number;
  variable_name: string;
  description?: string;
  llm_client: string;
  model: string;
  type: "text" | "json";
  options: Record<string, any>;
  tool_choice?: string;
  conversational?: boolean;
  content: string;
}

export interface AgentData {
  id: string;
  name: string;
  voice?: string;
  avatar?: string;
  description: string;
  chained: boolean;
  prompts: Prompt[];
  timeout?: number;
  tools: ToolSchema[];
  wanted_responses?: string[];
  in_tools?: InTool[];
}
