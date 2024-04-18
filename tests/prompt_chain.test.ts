import { expect, test } from "vitest";
import PromptChain from "../prompt_chain";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY as string,
  baseURL: "https://api.together.xyz/v1",
});

const google_client = new GoogleGenerativeAI(
  process.env.GOOGLE_API_KEY as string,
);

test("Prompt chain", async () => {
  return 1; // turning off for now (takes a lot of time)

  // const prompt_chain = new PromptChain({
  //   session: { id: "1", user_name: "Kais" },
  //   clients: [
  //     {host: "openai", client},
  //     {host: "google", client: google_client}
  //   ],
  //   prompts: [
  //     {
  //       id: "prompt-1",
  //       variable_name: "topics",
  //       model: "gemini-1.5-pro-latest",
  //       type: "text",
  //       options: {},
  //       llm_client: "google",
  //       conversational: true,
  //       index: 0,
  //       content:
  //         "Your role is to respond with a list of up to 5 keywords about the topic <<topic>>. just respond with the keywords without anything explaination. taking in consideration the context and user request.",
  //       inputs: [
  //         {
  //           id: "topic",
  //           type: "string",
  //           description: "The main topic of the research",
  //           required: true,
  //         },
  //       ],
  //     },
  //     {
  //       id: "prompt-2",
  //       variable_name: "description",
  //       model: "gemini-1.5-pro-latest",
  //       type: "text",
  //       options: {},
  //       llm_client: "google",
  //       conversational: true,
  //       index: 1,
  //       content:
  //         "Your role is to respond with a description for each one of these keywords: <<topics>>. while taking in consideration the context and research topics. respond in the formate keyword: description",
  //       inputs: [
  //         {
  //           id: "topics",
  //           type: "string",
  //           description: "The keywords",
  //           required: true,
  //         },
  //       ],
  //     },
  //   ],
  //   tools: [
  //     {
  //       type: "function",
  //       executor: (_inputs) => {
  //         return {
  //           search_query: "Motivational Rap songs by Eminem. category: rap, motivation"
  //         };
  //       },
  //       tool: {
  //         type: "function",
  //         function: {
  //           name: "search_history",
  //           description: "Retrieve songs search history",
  //           parameters: {
  //             type: "object",
  //             properties: {
  //               number: {
  //                 description: "The number of search entries wanted",
  //                 type: "number",
  //               },
  //             },
  //             required: ["number"],
  //           },
  //         },
  //       },
  //     },
  //   ],
  //   stream: (_stream: StreamMessage) => {},
  //   statusUpdate: (_status: string) => {},
  // });
  //
  // const run = await prompt_chain.run({
  //   run_id: "run_1",
  //   inputs: {
  //     message:
  //       "My research topic is Music, Get the latest song I searched for from my history and make the keywords about its category",
  //   },
  //   history: [],
  //   timeout: 30000
  // });
  //
  // expect(typeof run.responses.topics.content).toBe("string");
  // expect(typeof run.responses.description.content).toBe("string");
  // expect(run.responses.description.type).toBe("text");
});
