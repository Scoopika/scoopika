import { SavedProvider } from "@scoopika/types";
import OpenAI from "openai";
import { OpenAILLM } from "../llms";

export function buildClient(provider: SavedProvider, model: string) {
  if (provider.type === "openai") {
    const openai = new OpenAI({
      baseURL: provider.name !== "openai" ? provider.baseURL : undefined,
      apiKey: provider.apiKey,
    });

    const client = new OpenAILLM();
    client.init(openai, model);

    return client;
  }

  // TODO
  throw new Error("");
}
