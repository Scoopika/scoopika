import { Scoopika } from "../../src";

const scoopika = new Scoopika();

(async () => {
  const id = await scoopika.generateAudioId(
    "Hello. how are you doing",
    "aura-luna-en",
  );
  console.log(id);
})();
