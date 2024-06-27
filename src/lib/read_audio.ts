import { Scoopika } from "..";
import { AudioPlug } from "@scoopika/types";

async function readAudio(
  scoopika: Scoopika,
  audio: AudioPlug,
): Promise<{ text: string; url: string }> {
  const type = audio.type;

  if (type === "function") {
    throw new Error("Function audio is not supported yet!");
  }

  const res = await scoopika.listen(audio);
  return res;
}

export default readAudio;
