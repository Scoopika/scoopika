import express from "express";
import cors from "cors";
import { Scoopika, Agent } from "../../core/dist";

const scoopika_token = process.env.SCOOPIKA_TOKEN;
const agent_id = process.env.AGENT_ID;

if (!scoopika_token || !agent_id) {
  throw new Error(
    "Make sure you have all the required variables in the .env file",
  );
}

const scoopika = new Scoopika();
scoopika.connectProvider("groq", process.env.GROQ as string);

const agent = new Agent(scoopika, {
  provider: "groq",
  model: "llama3-8b-8192",
  prompt: "You are a helpful AI assistant called Scoopy"
});

const app = express();
app.use(express.json());
app.use("/*", cors());

app.post("/scoopika", (req, res) =>
  agent.serve({
    request: req.body,
    stream: (s) => res.write(s),
    end: () => res.end(),
  }),
);

app.listen(4149, () => {
  console.log("listening on port 4149");
});
