import { Scoopika, Agent } from "./src";

const id = process.env.AGENT_ID;

if (!id) {
  throw new Error("Add AGENT_ID to your .env file");
}

const scoopika = new Scoopika({
  engines: {
    fireworks: "123",
  },
});
const agent = new Agent(id, scoopika);

(async () => {
  const speech = await agent.speak("Hello");
  console.log(speech);
})();
