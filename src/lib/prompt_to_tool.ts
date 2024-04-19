function promptToTool(
  prompt: Prompt,
  inputs: PromptInput[],
): { tool: Tool; name: string } {
  const properties: Record<string, Parameter> = {};
  const required: string[] = [];

  inputs.map((input) => {
    if (input.required) {
      required.push(input.id);
    }
    delete input.required;
    properties[input.id] = input;
    delete (properties[input.id] as any).id;
  });

  const tool: Tool = {
    type: "function",
    function: {
      name: prompt.variable_name,
      description: prompt.description || prompt.variable_name,
      parameters: {
        type: "object",
        properties,
        required,
      },
    },
  };

  return { tool, name: prompt.variable_name };
}

export default promptToTool;
