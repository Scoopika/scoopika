import { Scoopika } from "..";
import { AudioPlug, Inputs } from "@scoopika/types";
import { readFileSync } from "node:fs";

async function readAudio(
  scoopika: Scoopika,
  request: Inputs,
  audio: AudioPlug,
): Promise<string> {
  const type = audio.type;

  if (type === "function") {
    return await audio.func(request);
  }

  let binary: Buffer | ArrayBuffer;

  if (type === "local") {
    binary = readFileSync(audio.path);
  } else {
    const res = await fetch(audio.path);
    if (!res.ok) {
      throw new Error(`Failed to read remote audio file: ${res.status}`);
    }
    binary = await res.arrayBuffer();
  }

  if (binary instanceof ArrayBuffer) {
    binary = Buffer.from(binary);
  }

  const text = await scoopika.recognizeSpeech(binary);
  return text;
}

export default readAudio;
