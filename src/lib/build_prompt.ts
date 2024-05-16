import * as types from "@scoopika/types";

function buildPrompt(
  prompt: types.Prompt,
  data: types.Inputs,
): types.BuiltPrompt {
  const inputs = prompt.inputs;
  let content = prompt.content;

  const missingInputs: types.PromptInput[] = [];

  inputs.map((input: types.PromptInput) => {
    const value = getInputValue(input, data);

    if (value === undefined) {
      return;
    }

    if (value.success === false) {
      missingInputs.push(input);
      return;
    }

    if (typeof value.value === "object" && value.value.length) {
      value.value = value.value.join(", ");
    } else if (typeof value.value !== "string") {
      value.value = String(value.value);
    }

    while (content.includes(`$${input.id}`)) {
      content = content.replace(`$${input.id}`, value.value);
    }
  });

  return {
    content: content,
    missing: missingInputs,
  };
}

function getInputValue(
  input: types.PromptInput,
  data: Record<string, any>,
):
  | { success: true; value: any }
  | { success: false; errors: string[] }
  | undefined {
  const value: string | undefined = data[input.id] || input.default;

  if (value === undefined && input.required) {
    return { success: false, errors: ["missing"] };
  }

  if (typeof value !== "boolean" && !value) {
    return undefined;
  }

  return { success: true, value };
}

export default buildPrompt;
