import { Scoopika } from "./src";

const scoopika = new Scoopika();

(async () => {
  const speech = await scoopika.speak({
    text: "I just love dancing in the rain at night, it gives me a romantic feeling... what about you?",
  });
  console.log(speech);

  // const audio = await scoopika.readAudio(speech);
  // console.log(audio);
})();
