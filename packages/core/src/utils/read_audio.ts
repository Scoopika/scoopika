import { Scoopika } from "../scoopika";
import { Audio } from "@scoopika/types";

export async function readAudio(
  scoopika: Scoopika,
  audio: Audio,
): Promise<{ text: string; url: string }> {
  const res = await scoopika.listen(audio);
  return res;
}
