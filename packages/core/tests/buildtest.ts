// Run with tsx to make sure the built version is working with TS

import { Scoopika, Model } from "../dist";
import * as dotenv from "dotenv";
dotenv.config();

const scoopika = new Scoopika({ token: "TOKEN" });
scoopika.connectProvider("groq", process.env.GROQ as string);
const model = new Model({
  scoopika,
  provider: "groq",
  model: "llama3-70b-8192",
});

(async () => {
  const res = await model.generateText({
    system_prompt: "",
    inputs: { message: "Hello" },
  });

  console.log(res);
})();
