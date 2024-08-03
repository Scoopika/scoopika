import {
  Audio,
  ProvidersName,
  SavedProvider,
  Store,
  VoiceResponse,
} from "@scoopika/types";
import { getEnv } from "./utils";
import { readMemoryStore } from "./memory";

export type Voice = "aura-luna-en" | "aura-orpheus-en";

export const VOICES: Voice[] = ["aura-orpheus-en", "aura-luna-en"];

export class Scoopika {
  private url: string;
  private token: string;
  private default_voice: Voice = VOICES[0];
  private host_audio: boolean = true;
  private knowledge: string | null = null;

  public memory: Store;

  providers: Record<string, SavedProvider> = {};
  private providers_urls: Record<string, string> = {
    together: "https://api.together.xyz/v1",
    fireworks: "https://api.fireworks.ai/inference/v1",
    openai: "",
    groq: "https://api.groq.com/openai/v1",
    perplexity: "https://api.perplexity.ai",
  };

  constructor({
    token,
    host_audio,
    memory,
    keys,
    knowledge,
  }: {
    token?: string;
    host_audio?: boolean;
    memory?: string | Store;
    keys?: Partial<Record<ProvidersName, string>>;
    knowledge?: string;
  } = {}) {
    this.token = getEnv("SCOOPIKA_TOKEN", true, token) as string;
    this.url = getEnv(
      "SCOOPIKA_SOURCE",
      true,
      "https://dev.scoopika.com",
    ) as string;

    if (typeof knowledge === "string") {
      this.knowledge = knowledge;
    }

    this.memory = readMemoryStore(memory, this.token, this.url);
    if (this.url.endsWith("/")) {
      this.url = this.url.substring(0, -1);
    }

    if (typeof host_audio === "boolean") {
      this.host_audio = host_audio;
    }

    keys = keys || {};
    const key_names = Object.keys(keys) as ProvidersName[];
    for (const key of key_names) {
      this.connectProvider(key, keys[key] as string);
    }
  }

  public getUrl() {
    return this.url;
  }

  public getToken() {
    return this.token;
  }

  public connectProvider(name: ProvidersName, api_key: string) {
    this.providers[name] = {
      // type: name === "anthropic" ? "anthropic" : "openai",
      type: "openai",
      name,
      apiKey: api_key,
      baseURL: this.providers_urls[name],
    };
  }

  public addProvider(provider: SavedProvider) {
    this.providers[provider.name] = provider;
  }

  async loadProvider(name: string) {
    if (!this.providers_urls[name]) {
      throw new Error(`The provider '${name}' is not yet available`);
    }

    if (this.providers[name]) return this.providers[name];

    const keys = await this.loadKeys();

    for (const key of keys) {
      const name = key.name;
      const apiKey = key.value;

      this.providers[name] = {
        name,
        apiKey,
        type: name === "anthropic" ? "anthropic" : "openai",
        baseURL: this.providers_urls[name],
      };
    }

    if (!this.providers[name]) {
      throw new Error(
        `You need to add '${name}' to your account or connect to it from your server using scoopika.connectProvider`,
      );
    }

    return this.providers[name];
  }

  public async loadKeys(): Promise<
    {
      name: string;
      value: string;
    }[]
  > {
    const res = await fetch(this.url + "/main/keys", {
      method: "GET",
      headers: {
        authorization: this.token,
      },
    });

    const data = (await res.json()) as
      | {
          success: false;
          error: string;
        }
      | {
          success: true;
          keys: { name: string; value: string }[];
        };

    if (data.success === false) {
      const err = data.error || "Remote server error";
      throw new Error(`ERROR loading API keys (${res.status}): ${err}`);
    }

    return data.keys;
  }

  public async readAudio(audio: string | VoiceResponse) {
    const audio_url = typeof audio === "string" ? audio : audio.read;

    const res = await fetch(audio_url);
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer);
  }

  public async speak({ text, voice }: { text: string; voice?: Voice }) {
    voice = voice || this.default_voice;

    if (VOICES.indexOf(voice) === -1) {
      console.warn("Invalid voice. falling to default voice");
      voice = this.default_voice;
    }

    const res = await fetch(this.url + "/main/speak", {
      method: "POST",
      headers: {
        authorization: this.token,
      },
      body: JSON.stringify({ text, voice }),
    });

    const data = await res.json();

    if (!data || !data.success) {
      const err = data.error || "Remote server error: Can't generate audio";
      throw new Error(err);
    }

    return data as { url: string; usage: number; id: string };
  }

  public async generateAudioId(text: string, voice?: Voice): Promise<string> {
    voice = voice ?? this.default_voice;
    if (VOICES.indexOf(voice) === -1) {
      voice = this.default_voice;
      console.warn("Invalid agent voice. falling back to default");
    }

    const res = await fetch(`${this.url}/audio/new`, {
      method: "POST",
      headers: { authorization: this.token },
      body: JSON.stringify({ voice, text }),
    });

    const data = await res.json();
    const id = data?.id;

    if (!data?.success || typeof id !== "string") {
      const err = data?.error || "Remote server error: Can't genearte audio ID";
      throw new Error(err);
    }

    return id;
  }

  public async listen(audio: Audio) {
    const res = await fetch(this.url + "/main/listen", {
      method: "POST",
      headers: {
        authorization: this.token,
      },
      body: JSON.stringify({
        data: audio,
        host: this.host_audio,
      }),
    });

    let data:
      | {
          success: false;
          error?: string;
        }
      | {
          success: true;
          text: string;
          url: string;
        } = await res.json();

    data = data ?? { success: false };

    if (data.success === false) {
      const err = data.error || "Can't recognize speech";
      throw new Error(`Remote sevrer error: ${err}`);
    }

    return { text: data.text, url: data.url };
  }

  public async rag(text: string, id?: string): Promise<string> {
    const knowledge = id || this.knowledge;
    try {
      if (!knowledge) {
        return "";
      }

      const res = await fetch(
        `${this.url}/pro/query-knowledge/${knowledge}`,
        {
          method: "POST",
          headers: { authorization: this.token },
          body: JSON.stringify({ text }),
        },
      );

      const data = await res.json();

      if (typeof data?.error === "string") {
        console.error(data?.error);
      }

      return (data?.data || "") as string;
    } catch (err) {
      console.error("Error loading custom knowledge", err);
      return "";
    }
  }

  public async scrape(urls: string[]): Promise<string[]> {
    if (urls.length < 1) {
      return [];
    }

    try {
      const res = await fetch(`${this.url}/main/scrape`, {
        method: "POST",
        headers: { authorization: this.token },
        body: JSON.stringify({ urls }),
      });

      const data = (await res.json()) as
        | {
            success: false;
            error: string;
          }
        | {
            success: true;
            content: string[];
          };

      if (data.success === false) {
        const err = data.error || "Unexpected remote error scraping websites";
        throw new Error(err);
      }

      return data.content;
    } catch (err) {
      console.error("Error scraping websites", err);
      return [];
    }
  }
}
