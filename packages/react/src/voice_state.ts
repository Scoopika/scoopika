import {
  AgentClient,
  RunVoicePlayer,
  VoiceRecorder,
  VoiceVisualizer,
} from "@scoopika/client";
import { UseChatStateOptions, useChatState } from "./state";
import { useEffect, useState } from "react";
import { Hooks, RunInputs, RunOptions } from "@scoopika/types";

export interface UseVoiceChatStateOptions extends UseChatStateOptions {
  auto_play_audio?: boolean;
  agent_voice?: {
    audio: HTMLAudioElement | string;
    canvas?: HTMLCanvasElement | string;
    wave_color?: string;
  };
}

export function useVoiceChatState(
  agent: string | AgentClient,
  state_options: UseVoiceChatStateOptions = {},
) {
  const chatState = useChatState(agent, state_options);

  const [agentVoicePlayer, setAgentVoicePlayer] =
    useState<RunVoicePlayer | null>(null);
  const [voiceRecorder, setVoiceRecorder] = useState<VoiceRecorder | null>(
    null,
  );

  const [voicePlaying, setVoicePlaying] = useState<boolean>(false);
  const [visualizer, setVisualizer] = useState<VoiceVisualizer | null>(null);
  const [recorderState, setRecorderState] = useState<
    "recording" | "paused" | "stopped"
  >("stopped");
  const [agentVoicePaused, setPlayerPaused] = useState<boolean>(false);

  const [working, setWorking] = useState<boolean>(false);

  const [recognizedText, setRecognizedText] = useState<string>();
  const [supportRecognition, setSupportRecognition] = useState<boolean | null>(
    null,
  );

  const pauseAgentVoice = () => {
    if (!agentVoicePlayer) return;
    agentVoicePlayer.pause();
    setPlayerPaused(true);
  };

  const resumeAgentVoice = () => {
    if (!agentVoicePlayer) return;
    agentVoicePlayer.resume();
    setPlayerPaused(false);
  };

  const updateRecognizedText = (text: string) => {
    if (voiceRecorder) voiceRecorder.stop();
    if (voiceRecorder) voiceRecorder.text = text;
    setRecognizedText(text);
  };

  useEffect(() => {
    setVoiceRecorder(
      new VoiceRecorder({
        onStateChange: (state) => setRecorderState(state),
        onText: (text) => setRecognizedText(text),
      }),
    );

    if (voiceRecorder) {
      setSupportRecognition(voiceRecorder.recognition !== null);
    }

    const visualize = state_options?.agent_voice;
    if (visualize?.canvas) {
      setVisualizer(
        new VoiceVisualizer(
          visualize.audio,
          visualize.canvas,
          visualize.wave_color,
        ),
      );
    }
  }, []);

  const newRequest = async ({
    inputs,
    options,
    hooks,
  }: {
    inputs?: RunInputs;
    options?: RunOptions;
    hooks?: Hooks;
  } = {}) => {
    try {
      if (agentVoicePlayer?.started) {
        agentVoicePlayer.pause();
        setVoicePlaying(false);
        setPlayerPaused(false);
      }

      let player: RunVoicePlayer | null = null;

      if (voiceRecorder?.started) voiceRecorder.stop();
      inputs = inputs || {};

      if (voiceRecorder?.started) {
        const recorderInputs = voiceRecorder
          ? await voiceRecorder.asRunInput()
          : null;
        let message = inputs?.message || "";
        const audio = inputs?.audio || [];

        if (recorderInputs?.message) {
          if (message.length > 0) message += "\n";
          message += recorderInputs.message;
        }

        if (recorderInputs?.audio) {
          audio.push(...recorderInputs.audio);
        }

        inputs = { ...(inputs || {}), message, audio };
      }

      setWorking(true);
      if (voiceRecorder?.started) await voiceRecorder.finish();
      options = { voice: true, ...(options || {}) };
      if (state_options?.agent_voice) {
        player = new RunVoicePlayer(state_options.agent_voice.audio);
        setAgentVoicePlayer(player);
      }

      if (visualizer) visualizer.getReady();

      const all_hooks: Hooks = {
        ...(hooks || {}),
        onAudio: (stream) => {
          if (state_options?.auto_play_audio !== false) {
            if (!player?.paused) {
              setPlayerPaused(false);
            }
            setVoicePlaying(true);
            if (player) player.queue(stream);
          }

          if (hooks?.onAudio) hooks.onAudio(stream);
        },
      };

      const response = await chatState.newRequest({
        inputs,
        options,
        hooks: all_hooks,
      });

      setWorking(false);
      if (player && response?.error === null)
        await player.finish(response.data.audio.length);

      setVoicePlaying(false);
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
      setWorking(false);
      setVoicePlaying(false);
    }
  };

  return {
    ...chatState,
    voiceRecorder,
    setVoiceRecorder,

    voicePlaying,
    setVoicePlaying,

    agentVoicePlayer,
    setAgentVoicePlayer,

    newRequest,

    visualizer,
    setVisualizer,

    recorderState,
    setRecorderState,

    recognizedText,
    setRecognizedText,

    supportRecognition,
    setSupportRecognition,

    updateRecognizedText,

    working,
    setWorking,

    pauseAgentVoice,
    resumeAgentVoice,

    agentVoicePaused,
    setPlayerPaused,
  };
}
