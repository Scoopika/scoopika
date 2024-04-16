class ToolRun {

  tool: ToolSchema;
  args: Record<string, any>;

  constructor(tool: ToolSchema, args: Record<string, any>) {
    this.tool = tool;
    this.args = args;
  }

  async execute(): Promise<{result: string}> {
    if (this.tool.type === "function") {
      return await this.executeFunction(this.tool);
    }

    if (this.tool.type === "api") {
      return await this.executeApi(this.tool);
    }

    return {result: "Invalid tool execution"}
  }

  async executeFunction(tool: FunctionToolSchema): Promise<{result: string}> {
    let result = await tool.executor(this.args);
    if (typeof result === "object") {
      result = JSON.stringify(result);
    }
    return {result: String(result)};
  }

  async executeApi(tool: ApiToolSchema): Promise<{result: string}> {
    const inputs: {
      method: typeof tool.method,
      headers: typeof tool.headers,
      data?: Record<string, any>
    } = {method: tool.method, headers: tool.headers};
    
    if (tool.method !== "get") {
      inputs.data = this.args;
    }

    const response = await fetch(tool.url, inputs);
    
    try {
      const data = await response.json();
      return {result: JSON.stringify(data)};
    } catch {
      const data = await response.text();
      return {result: data};
    }

  }

}

export { ToolRun };
