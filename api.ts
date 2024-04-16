async function loadAgent(id: string): Promise<AgentData> {
  return {
    id: id,
    name: "cat",
    description: "this is a cat",
    chained: false,
    tools: [],
    prompts: [
      {
        id: "prompt_1",
        index: 0,
        llm_client: "together",
        model: "mistralai/Mistral-7B-Instruct-v0.1",
        options: {},
        type: "text",
        variable_name: "cat_prompt",
        content: "Act like a cat called <<name>>, and colored <<color>>",
        inputs: [
          {
            id: "name",
            description: "the cat name",
            required: true,
            type: "string",
          },
          {
            id: "color",
            description: "the cat color",
            required: true,
            type: "string",
            default: "white",
          },
        ],
      },
    ],
  };
}

const api = {
  loadAgent,
};

export default api;
