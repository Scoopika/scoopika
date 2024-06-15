import { Scoopika, Agent } from "./src";

const scoopika = new Scoopika();
const agent = new Agent(process.env.AGENT_ID as string, scoopika);

(async () => {
  const session_id = `${Date.now()}`;

  try {
    await agent.run({
      options: { session_id },
      inputs: {
        message: "Hi 1",
        images: ["https://avatars.githubusercontent.com/u/164682378?s=200&v=4"],
      },
    });
  } catch (err) {}

  await agent.run({
    options: { session_id },
    inputs: {
      message: "Hi 2",
    },
  });

  await agent.run({
    options: { session_id },
    inputs: {
      message: "Hi 3",
    },
  });
})();
