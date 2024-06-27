import Box from "./box";
import Scoopika from "./scoopika";

export type SetupBoxesFunc = (scoopika: Scoopika) => Box[] | Promise<Box[]>;

function setupBoxs(
  boxes: string[] | SetupBoxesFunc,
): (scoopika: Scoopika) => Box[] | Promise<Box[]> {
  if (typeof boxes === "function") {
    return boxes;
  }

  if (typeof boxes !== "object" || !Array.isArray(boxes)) {
    throw new Error(
      "Invalid arg for setupBoxs. has to be a function or string[]",
    );
  }

  return async (scoopika: Scoopika) => {
    return boxes.map((a) => new Box(a, scoopika));
  };
}

export default setupBoxs;
