function setupInputs(
  current_inputs: LLMFunctionBaseInputs,
): LLMCompletionInputs {
  let { messages, model, tool_choice, tools, response_format } = current_inputs;

  if (!tool_choice) {
    tool_choice = "auto";
  }

  const inputs: LLMCompletionInputs = {
    model,
    messages: messages as any,
  };

  if (response_format) {
    inputs.response_format = { type: "json_object", schema: response_format };
  }

  if (tools.length > 0) {
    inputs.tools = tools;
    inputs.tool_choice = tool_choice;
  }

  return inputs;
}

export default setupInputs;
