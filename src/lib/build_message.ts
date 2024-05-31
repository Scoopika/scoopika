import { Inputs, UserContentHistory } from "@scoopika/types";

function buildMessage(inputs: Inputs): UserContentHistory["content"] {
  const messages: UserContentHistory["content"] = [];

  if (inputs.message) {
    messages.push({ type: "text", text: inputs.message });
  }

  if (!inputs?.plug?.images) {
    return messages;
  }

  const images = inputs.plug.images;

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

export default buildMessage;
