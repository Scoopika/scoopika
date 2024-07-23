import { RunAudioPlayer } from "@scoopika/client";
import { AudioStream } from "@scoopika/types";
import { useEffect, useState } from "react";

export function useAgentVoicePlayer({
  element,
}: {
  auto_play_audio?: boolean;
  element: HTMLAudioElement | string;
}) {
  const [agentVoicePlayer, setAgentVoicePlayer] =
    useState<RunAudioPlayer | null>(null);
  const [playing, setPlaying] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);

  useEffect(() => {
    if (!agentVoicePlayer) {
      setAgentVoicePlayer(new RunAudioPlayer(element));
    }
  }, []);

  const queue = (stream: AudioStream) => {
    if (!agentVoicePlayer) return;
    agentVoicePlayer.queue(stream);
    setPlaying(true);
  };

  const pause = () => {
    if (!agentVoicePlayer) return;
    agentVoicePlayer.pause();
    setPaused(true);
  };

  const resume = () => {
    if (!agentVoicePlayer) return;
    agentVoicePlayer.resume();
    setPaused(false);
  };

  return {
    agentVoicePlayer,
    setAgentVoicePlayer,
    playing,
    paused,
    pause,
    resume,
    queue,
  };
}
