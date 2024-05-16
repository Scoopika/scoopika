import { GoogleGenerativeAI } from "@google/generative-ai";
import { AllEngines, LLMClient, RawEngines } from "@scoopika/types";
import OpenAI from "openai";

export default function buildClients(engines: RawEngines): LLMClient[] {
  const baseUrls: Record<AllEngines, string> = {
    together: "https://api.together.xyz/v1",
    fireworks: "https://api.fireworks.ai/inference/v1",
    openai: "",
    google: "",
  };

  const built: LLMClient[] = (Object.keys(engines) as AllEngines[]).map(
    (key): LLMClient => {
      if (key === "google") {
        return {
          host: "google",
          client: new GoogleGenerativeAI(engines[key] || ""),
        };
      }

      if (key === "openai") {
        return {
          host: "openai",
          client: new OpenAI({
            apiKey: engines[key],
          }),
        };
      }

      return {
        host: key,
        client: new OpenAI({
          baseURL: baseUrls[key],
          apiKey: engines[key],
        }),
      };
    },
  );

  return built;
}
