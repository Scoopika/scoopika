import { LLMFunctionBaseInputs, LLMCompletionInputs } from "@scoopika/types";

function setupInputs(
  current_inputs: LLMFunctionBaseInputs,
): LLMCompletionInputs {
  let { messages, model, tool_choice, tools, response_format, options } =
    current_inputs;

  if (!tool_choice) {
    tool_choice = "auto";
  }

  const inputs: LLMCompletionInputs = {
    model,
    messages: messages as any,
    options,
  };

  if (response_format) {
    inputs.response_format = response_format;
  }

  if (tools.length > 0) {
    inputs.tools = tools;
    inputs.tool_choice = tool_choice;
  }

  return inputs;
}

export default setupInputs;
