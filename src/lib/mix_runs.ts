import { Scoopika } from "..";
import resolveInputs from "./resolve_inputs";
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
  if (!message && (!images || images.length < 1)) {
    return "";
  }

  if (message && (!images || images.length < 1)) {
    return message;
  }

  return [
    { type: "text", text: message ?? "" },
    ...(images?.map(
      (i): UserImageContent => ({
        type: "image_url",
        image_url: { url: i },
      }),
    ) || []),
  ];
}

export default async function mixRuns(
  scoopika: Scoopika,
  agent_id: string,
  session: StoreSession,
  runs: RunHistory[],
) {
  let mixed: LLMHistory[] = [];
  let latest_user_message: string | undefined = undefined;
  let latest_user_images: string[] | undefined = undefined;

  for await (const run of runs) {
    const role = run.role;

    if (role === "user") {
      const message = (await resolveInputs(scoopika, run.request)).message;
      latest_user_message = message;
      latest_user_images = run.request.plug?.images;
      continue;
    }

    const is_self = agent_id === run.agent_id;

    if (is_self) {
      if (latest_user_message) {
        mixed.push({
          role: "user",
          content: getUserContent(latest_user_message, latest_user_images),
        });
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
        content: run.response.content as string,
      });
      continue;
    }

    const calls: string[] = run.tools.map((t) => {
      let res = t.result;

      if (typeof res === "object") {
        res = JSON.stringify(res);
      }

      const text = `${run.agent_name} executed the tool ${t.call.function.name}, and it returned the following result: ${res}`;

      return text;
    });

    const user_name = session.user_name ? ` (${session.user_name})` : "";

    const content = getUserContent(
      `This is a conversation between the user${user_name} and another AI assistant called ${run.agent_name}:\nThe user: ${latest_user_message}\n${calls.join("\n")}\n${run.agent_name} (AI assistant): ${run.response.content}`,
      latest_user_images,
    );

    mixed.push({
      role: "user",
      content,
    });
  }

  return mixed;
}
