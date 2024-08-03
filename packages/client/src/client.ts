import { AgentRequest, ServerRequest } from "@scoopika/types";
import readStreamChunk from "./lib/read_stream";
import { Store } from "./store";

export interface FailedRequest {
  data: null;
  error: string;
}

export interface SuccessRequestResponse<Data> {
  data: Data;
  error: null;
}

export type RequestResponse<Data> =
  | FailedRequest
  | SuccessRequestResponse<Data>;

export class Client {
  apiUrl: string;
  store: Store;

  constructor(apiUrl: string) {
    if (apiUrl.endsWith("/")) {
      apiUrl = apiUrl.substring(0, apiUrl.length - 1);
    }
    this.apiUrl = apiUrl;
    this.store = new Store(this);
  }

  async request(req: ServerRequest | AgentRequest, onMessage: (msg: string) => any) {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req),
    };

    try {
      const res = await fetch(this.apiUrl, options);
      const reader = res.body?.getReader();
      let chunked: string | undefined;

      if (!reader) {
        throw new Error("Can't get HTTP stream reader");
      }

      while (true) {
        const chunk = await reader.read();
        const read = await readStreamChunk(chunk, onMessage, chunked);

        if (typeof read === "string") {
          chunked = read;
        } else {
          chunked = undefined;
        }

        if (chunk.done) {
          break;
        }
      }

      reader?.releaseLock();
    } catch (err) {
      console.error(err);
      onMessage(JSON.stringify({ error: JSON.stringify(err), data: null }));
    }
  }

  readResponse<Response>(s: string): RequestResponse<Response> {
    try {
      return JSON.parse(s) as RequestResponse<Response>;
    } catch (err: any) {
      console.error(`Can't read server response: ${err}`);
      return { data: null, error: JSON.stringify(err) };
    }
  }
}
