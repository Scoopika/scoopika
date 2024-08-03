import * as types from "@scoopika/types";
import { Client } from "./client";
import { executeStreamHooks } from "./lib/read_stream";
import executeAction from "./lib/actions_executer";
import { z } from "zod";
import { createAction } from "./actions/create_action";
import madeActionToFunctionTool from "./lib/made_action_to_function_tool";
import { createSchema } from "./lib/create_schema";

export class AgentClient {
  client: Client;
  client_actions: types.ToolSchema[] = [];
  paused_runs: string[] = [];

  constructor(endpoint: string) {
    this.client = new Client(endpoint);
  }

  async run({
    inputs,
    hooks,
    options,
  }: {
    inputs: types.RunInputs;
    options?: types.RunOptions;
    hooks?: types.Hooks;
  }) {
    if (!hooks) {
      hooks = {};
    }

    options = options ?? {};
    options.run_id = options.run_id ?? "run_" + crypto.randomUUID();

    let response: types.ModelTextResponse | undefined = undefined;

    hooks.onClientSideAction = (action) =>
      executeAction(action, [
        ...(options?.tools || []),
        ...this.client_actions,
      ]);

    hooks.onFinish = (res) => {
      response = res;
    };

    const used_hooks = Object.keys(hooks) as (keyof types.Hooks)[];

    const req: types.TextGenerationRequest = {
      type: "run_agent",
      payload: {
        inputs,
        options: {
          ...(options || {}),
          tools: [...(options?.tools || []), ...this.client_actions],
        },
        hooks: used_hooks,
      },
    };

    const onMessage = async (s: string) => {
      if (this.paused_runs.indexOf(options.run_id || "NONE") !== -1) return;
      await executeStreamHooks(s, hooks);
    };

    await this.client.request(req, onMessage);

    if (!response) {
      throw new Error("Did not receive a final response from the server");
    }

    return response as types.ModelTextResponse;
  }

  async structuredOutput<
    SCHEMA extends z.ZodTypeAny = any,
    DATA = z.infer<SCHEMA>,
  >(args: {
    inputs: types.RunInputs;
    optins?: types.RunOptions;
    prompt?: string;
    max_tries?: number;
    schema: SCHEMA;
  }) {
    let response: string = "";
    const onMessage = (s: string) => (response += s);

    const json_schema = createSchema(args.schema);

    const request: types.AgentJSONGenerationRequest = {
      type: "agent_generate_json",
      payload: {
        ...args,
        schema: json_schema,
      },
    };

    await this.client.request(request, onMessage);

    const data = this.client.readResponse<DATA>(response);

    return data;
  }

  addClientAction<PARAMETERS extends z.ZodTypeAny, RESULT = any>(
    tool?: types.CoreTool<PARAMETERS, RESULT>,
  ) {
    if (!tool) return;

    const action = createAction(tool);
    this.client_actions = [
      ...this.client_actions.filter(
        (a) => a.tool.function.name !== action.schema.name,
      ),
      madeActionToFunctionTool(action),
    ];
  }

  removeClientAction(name: string) {
    this.client_actions = this.client_actions.filter(
      (c) => c.tool.function.name !== name,
    );
  }

  removeAllClientActions() {
    this.client_actions = [];
  }

  cancelRun(run_id: string) {
    this.paused_runs.push(run_id);
  }
}
