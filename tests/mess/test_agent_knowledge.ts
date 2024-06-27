import { Scoopika, Agent } from "../../src";

const scoopika = new Scoopika({
  beta_allow_knowledge: true,
});
const agent = new Agent(process.env.AGENT_ID as string, scoopika);

agent.run({
  inputs: {
    message:
      "What is the recent certificate that Kais Radwan got and when did he get it? and tell me more details about it",
  },
  hooks: {
    onToken: (t) => process.stdout.write(t),
  },
});
