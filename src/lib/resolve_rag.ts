import { Inputs } from "@scoopika/types";

async function resolveRAG(inputs: Inputs): Promise<Inputs> {
  if (!inputs.message || !inputs.plug?.rag) {
    return inputs;
  }

  const rag =
    typeof inputs.plug?.rag === "string"
      ? inputs.plug?.rag
      : await inputs.plug?.rag(inputs.message);

  if (!rag || typeof rag !== "string" || rag.length < 1) {
    return inputs;
  }

  return {
    ...inputs,
    message: "More data that might be helpful:\n" + rag + "\n\n" + inputs.message,
  };
}

export default resolveRAG;
