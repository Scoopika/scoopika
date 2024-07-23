import { AudioStream } from "@scoopika/types";
import sleep from "./lib/sleep";

interface Listener {
  index: number;
  c_index: number;
  listener: () => any;
}

class RunAudioPlayer {
  private done_indexes: number[] = [];
  private audioContext: AudioContext;
  private currentSource?: AudioBufferSourceNode;
  public stopped: boolean = false;
  public paused: boolean = false;
  private currentIndex: number = 0;
  private listeners: Listener[] = [];
  private started: boolean = false;
  private done_calls: number[] = [];
  private received_chunks: Record<number, number[]> = {};
  private read_chunks: Record<number, number[]> = {};
  private chunks_queue: Record<
    number,
    { c_index: number; buffer: AudioBuffer }[]
  > = {};

  constructor() {
    if (typeof window === undefined) {
      throw new Error("The audio player runs only in browser environment");
    }
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.audioContext = audioContext;
  }

  init() {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.audioContext = audioContext;
  }

  async queue(call: AudioStream) {
    const play = this.play.bind(this);
    if (call.read.replace("data:audio/mpeg;base64,", "").length === 0) {
      this.done_calls.push(call.index);
      if (call.index === 0) {
        play(
          call.index,
          call.chunk_index,
          new AudioBuffer({ length: 1, sampleRate: 40000 }),
          false,
        );
      } else {
        this.listeners.push({
          index: call.index,
          c_index: call.chunk_index,
          listener: () => {
            play(
              call.index,
              call.chunk_index,
              new AudioBuffer({ length: 1, sampleRate: 40000 }),
              false,
            );
          },
        });
      }
      return;
    }

    if (!this.received_chunks[call.index]) {
      this.received_chunks[call.index] = [];
    }
    if (!this.read_chunks[call.index]) {
      this.read_chunks[call.index] = [];
    }

    this.received_chunks[call.index].push(call.chunk_index);
    const res = await fetch(call.read);
    const buffer = await res.arrayBuffer();
    const audio_buffer = await this.audioContext.decodeAudioData(buffer);

    const listener: Listener = {
      index: call.index,
      c_index: call.chunk_index,
      listener: () => play(call.index, call.chunk_index, audio_buffer),
    };

    if (call.index !== 0 && this.done_indexes.indexOf(call.index) === -1) {
      this.listeners.push(listener);

      return;
    }

    if (this.started && this.currentIndex === call.index) {
      this.listeners.push(listener);
      return;
    }

    this.play(call.index, call.chunk_index, audio_buffer);
  }

  private concatBuffers(index: number): AudioBuffer {
    const chunks = this.chunks_queue[index];
    if (!chunks || chunks.length === 0) {
      throw new Error(`No chunks found for index ${index}`);
    }

    const totalLength = chunks.reduce(
      (acc, chunk) => acc + chunk.buffer.length,
      0,
    );
    const concatenatedBuffer = this.audioContext.createBuffer(
      chunks[0].buffer.numberOfChannels,
      totalLength,
      chunks[0].buffer.sampleRate,
    );

    let offset = 0;
    for (const chunk of chunks) {
      for (
        let channel = 0;
        channel < chunk.buffer.numberOfChannels;
        channel++
      ) {
        concatenatedBuffer
          .getChannelData(channel)
          .set(chunk.buffer.getChannelData(channel), offset);
      }
      offset += chunk.buffer.length;
    }

    // Clear the chunks from the queue
    this.chunks_queue[index] = [];

    return concatenatedBuffer;
  }

  private queueChunk(index: number, c_index: number, buffer: AudioBuffer) {
    if (!this.chunks_queue[index]) this.chunks_queue[index] = [];

    this.chunks_queue[index].push({ c_index, buffer });
  }

  private async play(
    index: number,
    c_index: number,
    buffer: AudioBuffer,
    queue?: boolean,
  ) {
    if (queue !== false) this.queueChunk(index, c_index, buffer);
    this.read_chunks[index].push(c_index);

    if (queue !== false || this.done_calls.indexOf(index) === -1) {
      return;
    }

    while (
      this.read_chunks[index].length !== this.received_chunks[index].length
    ) {
      await sleep(5);
    }

    const fullBuffer = this.concatBuffers(index);
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = fullBuffer;
    this.currentSource.connect(this.audioContext.destination);
    this.currentIndex = index;
    this.started = true;

    this.currentSource.onended = () => {
      const nextChunk = this.listeners.filter(
        (l) => l.index === index && l.c_index === c_index + 1,
      )[0];
      const nextCall = this.listeners.filter(
        (l) => l.index === index + 1 && l.c_index === 0,
      )[0];

      if (nextChunk) {
        nextChunk.listener();
        return;
      }

      if (nextCall) {
        nextCall.listener();
      }

      this.done_indexes.push(index);
      this.currentIndex++;
    };

    if (!this.stopped && !this.paused) {
      this.currentSource.start();
    }
  }

  public pause() {
    if (!this.currentSource) return;
    this.currentSource.stop();
    this.paused = true;
  }

  public resume() {
    if (this.paused) {
      this.paused = false;
      this.currentSource?.start();
    }
  }

  public stop() {
    if (this.currentSource) this.currentSource.stop();
    this.stopped = true;
  }

  public reset() {
    if (this.currentSource) this.currentSource.stop();
    this.done_indexes = [];
    this.currentIndex = 0;
    this.stopped = false;
    this.paused = false;
    this.chunks_queue = {};
    this.received_chunks = {};
    this.done_calls = [];
  }
}

export default RunAudioPlayer;
