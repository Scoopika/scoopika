import { AudioRes } from "@scoopika/types";
import Hooks from "./hooks";
import Scoopika from "./scoopika";
import sleep from "./lib/sleep";
import crypto from "node:crypto";

const PUNCTUATION = [". ", "?", "!", ":", ";"];

class AudioStore {
  public scoopika: Scoopika;
  public chunks: AudioRes[] = [];
  public done_indexes: number[] = [];
  public hooks: Hooks;
  public run_id: string;
  public voice?: string;
  public index: number = 0;
  public calls: number = 0;
  public failed: number = 0;
  public sentence: string = "";
  public later: string = "";
  public listeners: Record<number, () => any> = [];

  constructor({
    scoopika,
    hooks,
    run_id,
    voice,
  }: {
    scoopika: Scoopika;
    hooks: Hooks;
    run_id: string;
    voice?: string;
  }) {
    this.scoopika = scoopika;
    this.run_id = run_id;
    this.voice = voice;
    this.hooks = hooks;
  }

  addChunk(chunk: AudioRes) {
    this.chunks.push(chunk);
    this.done_indexes.push(chunk.index);
    this.hooks.executeHook("onAudio", chunk);
    console.log("Push audio", chunk.index);
    const listener = this.listeners[chunk.index];
    if (listener) listener();
  }

  queueChunk(chunk: AudioRes) {
    if (
      chunk.index === 0 ||
      this.done_indexes.indexOf(chunk.index - 1) !== -1
    ) {
      this.addChunk(chunk);
      return;
    }

    const addChunk = this.addChunk.bind(this);
    this.listeners[chunk.index - 1] = () => {
      addChunk(chunk);
    };
  }

  async handleToken(segment: string) {
    this.sentence += segment;
    for (const p of PUNCTUATION) {
      if (this.sentence.includes(p)) {
        const [prevSentence, newSentence] = this.sentence.split(p, 2);
        this.sentence = newSentence;
        this.generate(prevSentence + p);
      }
    }
  }

  async generate(sentence: string, last?: boolean) {
    if (sentence.length < 5 && last !== true) {
      this.later += ` ${sentence}`;
      return;
    }

    if (this.later.length > 0) {
      sentence = this.later + " " + sentence;
    }

    this.later = "";

    try {
      this.calls += 1;
      const this_index = Number(this.index);
      this.index += 1;
      const audio = await this.scoopika.speak({
        text: sentence,
        voice: this.voice,
      });
      const chunk: AudioRes = {
        index: this_index,
        run_id: this.run_id,
        audio_id: audio.id,
        read: audio.url,
      };

      this.queueChunk(chunk);
    } catch (err) {
      this.failed += 1;
      console.error(err);
    }
  }

  async isDone() {
    if (this.sentence.length > 0) {
      await this.generate(this.sentence, true);
      this.sentence = "";
    }

    while (this.chunks.length + this.failed !== this.calls) {
      await sleep(10);
    }

    return this.failed < 1;
  }

  turnOn() {
    const handleToken = this.handleToken.bind(this);
    this.hooks.addHook("onToken", (t) => handleToken(t));
  }
}

export default AudioStore;
