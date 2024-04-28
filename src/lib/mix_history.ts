import { LLMHistory } from "@scoopika/types";

function mixHistory(history: LLMHistory[]): string {
  const stringHistory = history.map((item) => {
    if (item.role === "user") {
      return `${item.name} (User): ${item.content}`;
    }

    if (item.role === "assistant" || item.role === "model") {
      return `${item.name} (AI assistant): ${item.content}`;
    }

    if (item.role === "tool") {
      return `Executed tool (${item.name}) with results: ${item.content}`;
    }

    if (item.role === "prompt") {
      return `${item.name || "result"}: ${item.content}`;
    }

    return `${item.name}: ${item.content}`;
  });
  return stringHistory.join(".\n");
}

export default mixHistory;
