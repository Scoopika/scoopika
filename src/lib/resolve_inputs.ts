import { Inputs, RunInputs } from "@scoopika/types";
import { Scoopika } from "..";
import readAudio from "./read_audio";

export default async function resolveInputs(
  scoopika: Scoopika,
  inputs: RunInputs,
) {
  let message = "";

  const data = inputs.context || [];
  const audios = inputs.audio;

  for (const item of data || []) {
    message += item.description + ":\n" + item.value;
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
