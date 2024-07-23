import { Hooks, ServerStream } from "@scoopika/types";

const hooks_mappings: Record<keyof Hooks, ServerStream["type"]> = {
  onStart: "start",
  onToken: "token",
  onAudio: "audio",
  onStream: "stream",
  onOutput: "stream",
  onFinish: "response",
  onModelResponse: "agent_response",
  onToolCall: "tool_call",
  onToolResult: "tool_result",
  onClientSideAction: "client_action",
  onJson: "generated_json",
};

function serverHooks(
  used_hooks: Array<keyof Hooks>,
  callBack: (stream: string) => any,
) {
  const hooks: Hooks = {};

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
