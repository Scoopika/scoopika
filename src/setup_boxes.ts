import Box from "./box";
import Scoopika from "./scoopika";

function setupAgents(
  boxes: string[] | ((scoopika: Scoopika) => Promise<Box[]>),
): (scoopika: Scoopika) => Promise<Box[]> {
  if (typeof boxes === "function") {
    return boxes;
  }

  if (typeof boxes !== "object" || !Array.isArray(boxes)) {
    throw new Error(
      "Invalid arg for setupAgents. has to be a function or string[]",
    );
  }

  return async (scoopika: Scoopika) => {
    return boxes.map((a) => new Box(a, scoopika));
  };
}

export default setupAgents;
