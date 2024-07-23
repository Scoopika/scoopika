import { Store } from "@scoopika/types";
import { InMemoryStore } from "./memory_store";
import { RemoteStore } from "./remote_store";

export function readMemoryStore(
  memory: Store | string | undefined,
  token: string,
  url: string,
): Store {
  if (!memory) memory = "memory";

  if (typeof memory !== "string") {
    return memory;
  }

  if (memory === "memory") {
    return new InMemoryStore();
  }

  return new RemoteStore(token, `${url}/store/${memory}`);
}
