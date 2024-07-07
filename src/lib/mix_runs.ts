import { Scoopika } from "..";
import {
  LLMHistory,
  RunHistory,
  StoreSession,
  ToolHistory,
  UserContentHistory,
  UserImageContent,
} from "@scoopika/types";

function getUserContent(
  message?: string | undefined,
  images?: string[],
): UserContentHistory["content"] {
  if (!images || images.length < 1) {
    return message || "";
  }

  return [
    { type: "text", text: message ?? "" },
    ...images.map(
      (i): UserImageContent => ({
        type: "image_url",
        image_url: { url: i },
      }),
    ),
  ];
}

export default async function mixRuns(runs: RunHistory[]) {
  let mixed: LLMHistory[] = [];

  for await (const run of runs) {
    const role = run.role;

    if (role === "user") {
      const message = run.resolved_message;
      mixed.push({
        role: "user",
        content: getUserContent(message, run.request.images),
      });

      continue;
    }

    const calls: ToolHistory[] = run.tools.map((t) => ({
      role: "tool",
      content: t.result,
      name: t.call.function.name,
      tool_call_id: t.call.id,
    }));

    mixed = [...mixed, ...calls];

    mixed.push({
      role: "assistant",
      content: run.response.content,
    });
  }

  return mixed;
}
