import { Agent, Client, Model } from "@scoopika/client";
import {
  ModelRunHistory,
  VoiceResponse,
  Hooks,
  LLMToolCall,
  RunHistory,
  RunInputs,
  RunOptions,
  UserRunHistory,
} from "@scoopika/types";
import { useEffect, useState } from "react";
import sleep from "./utils/sleep";

export interface UseChatStateOptions {
  session_id?: string;
  scroll?: () => any;
}

const setupRequest = (
  session_id: string,
  inputs: RunInputs,
  run_id?: string,
  user_id?: string,
) => {
  const req: UserRunHistory = {
    role: "user",
    at: Date.now(),
    session_id,
    run_id: run_id || crypto.randomUUID(),
    user_id,
    request: inputs,
    resolved_message: "PLACEHOLDER",
  };

  return req;
};

const agentPlaceholder = ({
  session_id,
  run_id,
  audio,
  tool_calls,
  content,
}: {
  session_id: string;
  run_id: string;
  audio: VoiceResponse[];
  tool_calls: { call: LLMToolCall; result: any }[];
  name?: string;
  content: string;
}) => {
  const placeholder: ModelRunHistory = {
    role: "model",
    at: Date.now(),
    session_id,
    run_id,
    response: {
      run_id,
      session_id,
      audio,
      tool_calls,
      content,
    },
  };

  return placeholder;
};

const sortedMessages = (messages: RunHistory[]) =>
  messages.sort((a, b) => a.at - b.at);

export function useChatState(
  client: Client,
  agent: string | Agent | Model,
  state_options?: UseChatStateOptions,
) {
  if (typeof agent === "string") {
    agent = new Agent(agent, client);
  }

  const [clientInstance] = useState(client);
  const [agentInstance] = useState(agent);

  // state
  const [session, setSession] = useState<string>(
    state_options?.session_id ?? "session_" + crypto.randomUUID(),
  );
  const [loadingSession, setLoadingSession] = useState<boolean>(false);
  const [status, setStatus] = useState<string | undefined>();
  const [generating, setGenerating] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<RunHistory[]>([]);
  const [streamPlaceholder, setStreamPlaceholder] = useState<
    ModelRunHistory | undefined
  >(undefined);

  const getSessionMessages = async (id: string) => {
    setLoadingSession(true);
    const { data: messages, error } =
      await clientInstance.store.getSessionRuns(id);
    if (error === null) setMessages(messages);
    setLoadingSession(false);
    if (state_options?.scroll) {
      scroll();
    }
  };

  const changeSession = async (session?: string) => {
    const id = session ?? crypto.randomUUID();
    setSession(id);
    await getSessionMessages(id);
  };

  useEffect(() => {
    if (state_options?.session_id) {
      getSessionMessages(state_options.session_id);
    }
  }, []);

  const newRequest = async ({
    inputs = {},
    options,
    hooks,
  }: {
    inputs?: RunInputs;
    options?: RunOptions;
    hooks?: Hooks;
  } = {}) => {
    try {
      while (generating || loading) {
        await sleep(5);
      }

      setLoading(true);
      options = { ...(options || {}) };
      options.session_id = session;
      const request = setupRequest(session, inputs, options?.run_id);
      let run_id = request.run_id;

      setStreamPlaceholder(
        agentPlaceholder({
          session_id: session,
          run_id,
          audio: [],
          content: "",
          tool_calls: [],
        }),
      );
      setMessages((prev) => [...sortedMessages(prev), request]);
      setStatus("Thinking...");

      const all_hooks: Hooks = {
        ...(hooks || {}),
        onStart: (info) => {
          run_id = info.run_id;
          if (state_options?.scroll) state_options.scroll();
        },
        onToken: (token) => {
          if (loading) setLoading(false);
          if (!generating) setGenerating(true);
          if (status) setStatus(undefined);

          setStreamPlaceholder((prev) => {
            if (!prev) return;
            return {
              ...prev,
              response: {
                ...prev.response,
                content: prev.response.content + token,
              },
            };
          });

          if (hooks?.onToken) hooks.onToken(token);
          if (state_options?.scroll) state_options.scroll();
        },
        onToolCall: (call) => {
          setStatus(`Talking with ${call.function.name}`);
          if (hooks?.onToolCall) hooks.onToolCall(call);
        },
        onToolResult: (res) => {
          setStatus(undefined);
          setStreamPlaceholder((prev) => {
            if (!prev) return;

            return {
              ...prev,
              response: {
                ...prev.response,
                tools_calls: [...prev.response.tool_calls, res],
              },
            };
          });
          if (hooks?.onToolResult) hooks.onToolResult(res);
        },
        onModelResponse: async (response) => {
          setStatus(undefined);
          const { data: messages, error } =
            await clientInstance.store.getSessionRuns(session);
          setStreamPlaceholder(undefined);
          if (error === null) setMessages(sortedMessages(messages));
          if (hooks?.onModelResponse) hooks.onModelResponse(response)
        },
      };

      const response = await agentInstance.run({
        inputs,
        options,
        hooks: all_hooks,
      });

      return response;
    } catch (err: any) {
      const err_string: string =
        typeof err === "string"
          ? err
          : typeof err?.msg === "string"
            ? err.msg
            : JSON.stringify(err);

      return { data: null, error: err_string };
    } finally {
      setStatus(undefined);
      setLoading(false);
      setGenerating(false);
      const { data: messages, error } =
        await clientInstance.store.getSessionRuns(session);
      if (error === null) setMessages(messages);
      if (state_options?.scroll) state_options.scroll();
    }
  };

  return {
    generating,
    loading,
    status,
    streamPlaceholder,

    messages,
    newRequest,
    agent,

    session,
    changeSession,
    loadingSession,
  };
}
