import { LLMHistory } from "@scoopika/types";

function mixHistory(history: LLMHistory[]): LLMHistory[] {
  const system_prompts = history.filter((i) => i.role === "system");

  const string_history = history
    .filter((i) => i.role !== "system")
    .map((item) => {
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

  const mixed_history: LLMHistory[] = [
    ...system_prompts,
    {
      role: "user",
      content: `Context history:\n${string_history.join(".\n")}`,
    },
  ];

  return mixed_history;
}

export default mixHistory;
