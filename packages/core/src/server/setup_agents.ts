import { Store } from "@scoopika/types";
import { Scoopika, Agent } from "../";

export type SetupAgentsFunc = (
  scoopika: Scoopika,
) => Agent[] | Promise<Agent[]>;

function setupAgents(
  agents: string[] | SetupAgentsFunc,
  memory: Store,
): (scoopika: Scoopika) => Agent[] | Promise<Agent[]> {
  if (typeof agents === "function") {
    return agents;
  }

  if (typeof agents !== "object" || !Array.isArray(agents)) {
    throw new Error(
      "Invalid arg for setupAgents. has to be a function or string[]",
    );
  }

  return async (scoopika: Scoopika) => {
    return agents.map((a) => new Agent(a, scoopika));
  };
}

export default setupAgents;
