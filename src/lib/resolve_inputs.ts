import { RemoteAudio, RunInputs } from "@scoopika/types";
import { Scoopika } from "..";
import readAudio from "./read_audio";

export default async function resolveInputs(
  scoopika: Scoopika,
  inputs: RunInputs,
): Promise<{ new_inputs: RunInputs; context_message: string }> {
  let message = "";
  let context_message = "";

  let data = inputs.context || [];
  const audios = inputs.audio;
  const audio_urls: RemoteAudio[] = [];

  for await (const a of audios || []) {
    const { text, url } = await readAudio(scoopika, a);
    audio_urls.push({ type: "remote", path: url });
    message += `\n${text}`;
  }

  context_message = message;
  for (const item of data || []) {
    message = item.description + ":\n" + item.value + "\n" + message;
  }

  for (const item of (data || []).filter((d) => d.scope === "session")) {
    context_message = item.description + ":\n" + item.value + "\n" + message;
  }

  if (message.length < 1) {
    return {
      new_inputs: { ...inputs, audio: audio_urls },
      context_message,
    };
  }

  return {
    new_inputs: { ...inputs, message, audio: audio_urls },
    context_message,
  };
}
