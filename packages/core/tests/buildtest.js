// Run with node to make sure the built version is working with JS

const { Scoopika, Model } = require("../dist");
const dotenv = require("dotenv");
dotenv.config();

const scoopika = new Scoopika({ token: "TOKEN" });
scoopika.connectProvider("groq", process.env.GROQ);
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
