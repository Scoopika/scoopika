import { Scoopika } from "./src";

const scoopika = new Scoopika();

(async () => {
  const speech = await scoopika.speak({ text: "Hello" });
  console.log(speech);

  const audio = await scoopika.readAudio(speech);
  console.log(audio);
})();
