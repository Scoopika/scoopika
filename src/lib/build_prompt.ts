function buildPrompt(prompt: Prompt, data: Inputs): BuiltPrompt {
  const inputs = prompt.inputs;
  let content = prompt.content;

  const missingInputs: PromptInput[] = [];

  inputs.map((input: PromptInput) => {
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

    while (content.includes(`<<${input.id}>>`)) {
      content = content.replace(`<<${input.id}>>`, value.value);
    }
  });

  return {
    content: content,
    missing: missingInputs,
  };
}

function getInputValue(
  input: PromptInput,
  data: Record<string, any>,
): FuncResponse | undefined {
  const value: string | undefined = data[input.id] || input.default;

  if (!value && input.required) {
    return { success: false, errors: ["missing"] };
  }

  if (!value) {
    return undefined;
  }

  return { success: true, value };
}

export default buildPrompt;
