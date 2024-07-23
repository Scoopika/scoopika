import { test, expect, expectTypeOf } from "vitest";
import { Client, Agent, Model } from "../src";
import crypto, { randomUUID } from "node:crypto";
import { StoreSession } from "@scoopika/types";
import { config } from "dotenv";
import { z } from "zod";

config();

const agent_id = process.env.AGENT_ID;

if (!agent_id) {
  throw new Error("Make sure AGENT_ID exist in .env file");
}

const client = new Client("http://localhost:4149/scoopika");
const agent = new Agent(agent_id, client);
const model = new Model({ client, provider: "groq", model: "llama3-70b-8192" });

const user_id = crypto.randomUUID();
let session: StoreSession = {} as StoreSession;

test("Create session", async () => {
  const { data, error } = await client.store.newSession({ user_id });

  if (error !== null) throw new Error(error);

  session = data;
  expect(data.user_id).toBe(user_id);
  expect(typeof session.id).toBe("string");
});

test("Load agent", async () => {
  const { data: agent_data, error } = await agent.load();

  if (error !== null) throw new Error(error);

  expect(agent_data.id).toBe(agent_id);
  expect(typeof agent_data.name).toBe("string");
});

test("Run agent", async () => {
  let message: string = "";
  const { data: response, error } = await agent.run({
    options: {
      session_id: session.id,
      run_id: `run_${Date.now()}`,
    },
    inputs: {
      message: "Hello!",
    },
    hooks: {
      onStart: (s) => console.log(s),
      onToken: (t) => (message += t),
      onStream: (_s) => {},
    },
  });

  if (error !== null) throw new Error(error);

  expect(typeof response.content).toBe("string");
});

test("List user sessions", async () => {
  const { data: sessions, error } =
    await client.store.listUserSessions(user_id);

  if (error !== null) throw new Error(error);

  expect(typeof sessions).toBe("object");
  expect(sessions.length).toBe(1);
  expect(sessions[0]).toBe(session.id);
});

test("Get session", async () => {
  const { data: ret_session, error } = await client.store.getSession(
    session.id,
  );

  if (error !== null) throw new Error(error);

  expect(ret_session.id).toBe(session.id);
  expect(ret_session.user_id).toBe(user_id);
});

test("Get session runs", async () => {
  const { data: runs, error } = await client.store.getSessionRuns(session.id);

  if (error !== null) throw new Error(error);

  expect(typeof runs).toBe("object");
  expect(runs.length).toBe(2);
});

test("Delete session", async () => {
  const { data: status, error } = await client.store.deleteSession(session.id);

  if (error !== null) throw new Error(error);

  expect(status).toBe(true);
});

test("Run model: text generation", async () => {
  const { data, error } = await model.run({
    inputs: { message: "Hello!" },
    options: { session_id: randomUUID(), run_id: randomUUID() },
  });

  if (error !== null) throw new Error(error);

  expectTypeOf(data.content).toBeString();
});

test("Run model: object generation", async () => {
  const { data, error } = await model.structuredOutput({
    inputs: { message: "My name is Kais" },
    schema: z.object({
      name: z.string().describe("The user name"),
    }),
  });

  if (error !== null) throw new Error(error);

  expectTypeOf(data.name).toBeString();
});

test("Run agent: object generation", async () => {
  const { data, error } = await agent.structuredOutput({
    inputs: { message: "My name is Kais" },
    schema: z.object({
      name: z.string().describe("The user name"),
    }),
    prompt: "Extract the user's name",
  });

  if (error !== null) throw new Error(error);

  expectTypeOf(data.name).toBeString();
});
