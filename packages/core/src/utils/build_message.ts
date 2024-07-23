import { RunInputs, UserMessageContent, UserRunHistory } from "@scoopika/types";

export function buildMessage(inputs: RunInputs) {
  if (!inputs.images || inputs.images.length < 1) {
    return inputs.message || "";
  }

  const messages: UserMessageContent[] = [];

  if (inputs.message) {
    messages.push({ type: "text", text: inputs.message });
  }

  const images = inputs.images || [];

  for (const img of images) {
    messages.push({
      type: "image_url",
      image_url: {
        url: img,
      },
    });
  }

  return messages;
}

export function buildMessageFromRun(run: UserRunHistory) {
  return buildMessage(run.request);
}
