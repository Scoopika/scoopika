import { expect, test } from "vitest";
import PromptChain from "../prompt_chain";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY as string,
  baseURL: "https://api.together.xyz/v1",
});

const google_client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string);

test("Prompt chain", async () => {
  const prompt_chain = new PromptChain({
    session: { id: "1", user_name: "Kais" },
    clients: { 
      openai: { host: "openai", client },
      google: { host: "google", client: google_client }
    },
    prompts: [
      {
        id: "prompt-1",
        variable_name: "topics",
        model: "gemini-1.5-pro-latest",
        type: "text",
        options: {},
        llm_client: "google",
        conversational: true,
        index: 0,
        content:
          "Your role is to respond with a list of up to 5 keywords about the topic <<topic>>. just respond with the keywords without anything explaination",
        inputs: [
          {
            id: "topic",
            type: "string",
            description: "The research topic",
            required: true,
          },
        ],
      },
      // {
      //   id: "prompt-2",
      //   variable_name: "description",
      //   model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
      //   type: "text",
      //   llm_client: "openai",
      //   conversational: true,
      //   index: 1,
      //   content:
      //     "Your role is to respond with a description for each one of these keywords: <<topics>>. while taking in consideration the context and research topics. respond in the formate keyword: description",
      //   inputs: [
      //     {
      //       id: "topics",
      //       type: "string",
      //       description: "The keywords",
      //       required: true,
      //     },
      //   ],
      // },
    ],
    tools: [
      {
        type: "function",
        executor: (inputs) => { console.log(inputs); return "The song is about love" },
        tool: {
          type: "function",
          function: {
            name: "song_information",
            description: "Get more information about a song",
            parameters: {
              type: "object",
              properties: {
                query: {
                  description: "The search query",
                  type: "string",
                }
              },
              required: ["query"]
            }
          }
        }
      }
    ],
    stream: (_stream: StreamMessage) => { console.log(_stream) },
    statusUpdate: (_status: string) => {}
  });

  const run = await prompt_chain.run(
    "run_1",
    { topic: "music", message: "Use the song information tool to search for information about the song Let Her go, and pick keywords from it" },
    [],
  );

  console.log(run);

  expect(typeof run.topics.content).toBe("string");
  // expect(typeof run.description.content).toBe("string");
  // expect(run.description.type).toBe("text");
});
