import { Inputs } from "@scoopika/types";
import { Scoopika } from "..";
import readAudio from "./read_audio";

export default async function resolveInputs(
  scoopika: Scoopika,
  inputs: Inputs,
) {
  if (!inputs.plug) {
    return inputs;
  }

  let message = "";

  const data = inputs.plug.data;
  const rag = inputs.plug.rag;
  const audios = inputs.plug.audio;

  if (rag) {
    const rag_res =
      typeof rag === "string" ? rag : await rag(inputs.message || "");
    message += "More information that might be helpful:\n" + rag_res;
  }

  for (const item of data || []) {
    message += item.description + ":\n" + item.data;
  }

  if (inputs.message) {
    message += "\nCurrent user request:\n" + inputs.message;
  }

  if ((!inputs.message && audios?.length) || 0 > 0) {
    message += "\nCurrent user request:\n";
  }

  for await (const a of audios || []) {
    const text = await readAudio(scoopika, { ...inputs, message }, a);
    message += `\n${text}`;
  }

  if (message.length < 1) {
    return inputs;
  }

  return { ...inputs, message };
}
