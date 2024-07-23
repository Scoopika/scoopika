import { AgentRunHistory, AudioRes, LLMToolCall } from "@scoopika/types";

const agentPlaceholder = ({
  id,
  session_id,
  run_id,
  name,
  audio,
  tools_calls,
  content,
}: {
  id: string;
  session_id: string;
  run_id: string;
  audio: AudioRes[];
  tools_calls: { call: LLMToolCall; result: any }[];
  name?: string;
  content: string;
}) => {
  const placeholder: AgentRunHistory = {
    role: "agent",
    at: Date.now(),
    session_id,
    run_id,
    agent_id: id,
    agent_name: name || "",
    tools: [],
    response: {
      run_id,
      session_id,
      audio,
      tools_calls,
      content,
    },
  };

  return placeholder;
};

export default agentPlaceholder;
