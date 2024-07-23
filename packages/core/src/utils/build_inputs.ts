import { Scoopika } from "../scoopika";
import { RemoteAudio, RunInputs } from "@scoopika/types";
import { readAudio } from "./read_audio";

export async function buildInputs(
  scoopika: Scoopika,
  inputs: RunInputs,
): Promise<{
  new_inputs: RunInputs;
  context_message: string;
}> {
  let message = inputs.message || "";
  let context_message = message;

  const updateMessage = (content: string, scope: "run" | "session" = "run") => {
    message += "\n" + content;
    if (scope === "session") context_message += "\n" + content;
  };

  let data: RunInputs["context"] = inputs.context ?? [];
  const audios = inputs.audio ?? [];

  // Process audio files concurrently
  const audioPromises = audios.map(async (a): Promise<RemoteAudio> => {
    const { text, url } = await readAudio(scoopika, a);
    updateMessage(text, "session");
    return { type: "remote", path: url };
  });

  // Process context data
  for (const item of data) {
    const content = `${item.description}: ${item.value}`;
    updateMessage(content, item.scope);
  }

  // Scrape websites concurrently
  const websitesPromise = scoopika.scrape(inputs.urls || []);
  const ragPromise = scoopika.rag(message);

  const [audio_urls, websites, rag] = await Promise.all([
    Promise.all(audioPromises),
    websitesPromise,
    ragPromise,
  ]);

  if (typeof rag === "string" && rag.length > 0) {
    updateMessage(rag, "run");
  }

  // Update message with website content
  websites.forEach((web) => updateMessage(web, "session"));

  return {
    context_message,
    new_inputs: { ...inputs, message, audio: audio_urls },
  };
}
