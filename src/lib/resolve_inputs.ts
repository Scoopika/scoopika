import { Inputs } from "@scoopika/types";

export default async function resolveInputs(inputs: Inputs) {
  if (!inputs.plug) {
    return inputs;
  }

  let message = "";

  const data = inputs.plug.data;
  const rag = inputs.plug.rag;

  if (rag) {
    const rag_res =
      typeof rag === "string" ? rag : await rag(inputs.message || "");
    message += "More information that might be helpful:\n" + rag_res;
  }

  for (const item of data || []) {
    message += item.description + ":\n" + item.data;
  }

  if (inputs.message) {
    message += "Current user request:\n" + inputs.message;
  }

  if (message.length < 1) {
    return inputs;
  }

  return { ...inputs, message };
}
