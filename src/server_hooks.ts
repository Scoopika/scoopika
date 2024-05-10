import { BoxHooks, ServerStream } from "@scoopika/types";

const hooks_mappings: Record<keyof BoxHooks, ServerStream["type"]> = {
  onStart: "start",
  onToken: "token",
  onError: "error",
  onStream: "stream",
  onFinish: "response",
  onAgentResponse: "agent_response",
  onToolCall: "tool_call",
  onToolResult: "tool_result",
  onSelectAgent: "select_agent",
  onBoxFinish: "box_response",
};

function serverHooks(
  used_hooks: Array<keyof BoxHooks>,
  callBack: (stream: string) => any,
) {
  const hooks: BoxHooks = {};

  used_hooks.forEach((hook) => {
    hooks[hook] = (data: unknown) => {
      const type = hooks_mappings[hook];
      const stream = { type, data } as ServerStream;
      callBack(`<SCOOPSTREAM>${JSON.stringify(stream)}</SCOOPSTREAM>`);
    };
  });

  return hooks;
}

export default serverHooks;
