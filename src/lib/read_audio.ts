import { Scoopika } from "..";
import { AudioPlug, Inputs } from "@scoopika/types";

async function readAudio(
  scoopika: Scoopika,
  request: Inputs,
  audio: AudioPlug,
): Promise<string> {
  const type = audio.type;

  if (type === "function") {
    return await audio.func(request);
  }

  let buffer: Buffer | ArrayBuffer;

  if (type === "base64") {
    buffer = Buffer.from(
      Uint8Array.from(atob(audio.value), (c) => c.charCodeAt(0)),
    );
  } else {
    const res = await fetch(audio.path);
    if (!res.ok) {
      throw new Error(`Failed to read remote audio file: ${res.status}`);
    }
    buffer = await res.arrayBuffer();
  }

  if (buffer instanceof ArrayBuffer) {
    buffer = Buffer.from(buffer);
  }

  const text = await scoopika.recognizeSpeech(buffer);
  return text;
}

export default readAudio;
