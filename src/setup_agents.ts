import Agent from "./agent";
import Scoopika from "./scoopika";

function setupAgents(
  agents: string[] | ((scoopika: Scoopika) => Promise<Agent[]>),
): (scoopika: Scoopika) => Promise<Agent[]> {
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
