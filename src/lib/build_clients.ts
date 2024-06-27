import { GoogleGenerativeAI } from "@google/generative-ai";
import { AllEngines, LLMClient, RawEngines } from "@scoopika/types";
import OpenAI from "openai";

export default function buildClients(
  base_urls: Record<AllEngines, string> & Record<string, string>,
  engines: RawEngines,
  dangerouslyAllowBrowser?: boolean,
): LLMClient[] {
  const built: LLMClient[] = (Object.keys(engines) as AllEngines[]).map(
    (key): LLMClient => {
      if (key === "google") {
        throw new Error(
          "Google is broken for now! we're working to fix it, sorry :(",
        );
      }

      if (key === "openai") {
        return {
          host: "openai",
          client: new OpenAI({
            apiKey: engines[key],
            dangerouslyAllowBrowser,
          }),
        };
      }

      const url = base_urls[key];

      if (!url) {
        console.error(
          `${key} is not supported. If using an extended provider make sure to extends it usin 'scoopika.extendProviders.
          or contact us so we support this provider.'`,
        );
      }

      return {
        host: key,
        client: new OpenAI({
          baseURL: base_urls[key],
          apiKey: engines[key],
          dangerouslyAllowBrowser,
        }),
      };
    },
  );

  return built;
}
