import {
  FunctionToolSchema,
  ServerClientActionStream,
  ToolSchema,
} from "@scoopika/types";

export default async function executeAction(
  call: ServerClientActionStream["data"],
  actions: ToolSchema[],
) {
  const wanted_action: FunctionToolSchema | undefined = actions.filter(
    (a) => a.type === "client-side" && a.tool.function.name === call.tool_name,
  )[0] as FunctionToolSchema;

  if (!wanted_action) {
    throw new Error(`Wanted server action not found: ${call.tool_name}`);
  }

  if (typeof call.arguments === "string") {
    call.arguments = JSON.parse(call.arguments);
  }

  await wanted_action.executor(call.arguments);
}
