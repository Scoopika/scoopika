import { AgentData, AgentToolSchema } from "@scoopika/types";

export function agentAsTool(
  agent: AgentData,
  executor: AgentToolSchema["executor"],
): AgentToolSchema {
  const agent_tool: AgentToolSchema = {
    type: "agent",
    agent_id: agent.id,
    executor,
    tool: {
      type: "function",
      function: {
        name: agent.name,
        description: `an AI agent called ${agent.name}. its task is: ${agent.description}`,
        parameters: {
          type: "object",
          properties: {
            instructions: {
              type: "string",
              description:
                "The instruction or task to give the agent. include all instructions to guide this agent",
            },
          },
          required: ["instructions"],
        },
      },
    },
  };

  return agent_tool;
}
