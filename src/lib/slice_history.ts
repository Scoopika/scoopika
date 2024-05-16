import { LLMHistory } from "@scoopika/types";

function sliceHistory(history: LLMHistory[], max?: number): LLMHistory[] {
  if (typeof max !== "number") {
    max = 20;
  }

  if (history.length < max) {
    return history;
  }

  const startIndex: number = max - history.length;
  return history.slice(startIndex);
}

export default sliceHistory;
