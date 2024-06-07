import { Inputs, RunInputs, UserContentHistory } from "@scoopika/types";

function buildMessage(inputs: RunInputs): UserContentHistory["content"] {
  const messages: UserContentHistory["content"] = [];

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

export default buildMessage;
