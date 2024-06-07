import { AudioRes } from "@scoopika/types";
import Hooks from "./hooks";
import Scoopika from "./scoopika";
import sleep from "./lib/sleep";

const PUNCTUATION = [".", "?", "!", ":", ";"];

class AudioStore {
  private scoopika: Scoopika;
  public chunks: AudioRes[] = [];
  private done_indexes: number[] = [];
  private hooks: Hooks;
  private run_id: string;
  private voice?: string;
  private index: number = 0;
  private calls: number = 0;
  private failed: number = 0;
  private sentence: string = "";
  private later: string = "";
  private listeners: Record<number, () => any> = [];

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

  turnOn() {
    this.hooks.addHook("onToken", this.handleToken.bind(this));
  }

  addChunk(chunk: AudioRes) {
    this.chunks.push(chunk);
    this.hooks.executeHook("onAudio", chunk);
    this.done_indexes.push(chunk.index);
    const listener = this.listeners[chunk.index];
    if (listener) listener();
  }

  queueChunk(chunk: AudioRes) {
    if (
      chunk.index === 0 ||
      this.done_indexes.indexOf(chunk.index - 1) !== -1
    ) {
      return this.addChunk(chunk);
    }

    const addChunk = this.addChunk;
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
      const id = await this.scoopika.speak({
        text: sentence,
        voice: this.voice,
      });
      const chunk: AudioRes = {
        index: this_index,
        run_id: this.run_id,
        read: `${this.scoopika.getUrl()}/pro/audio/${id}`,
        audio_id: id,
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
}

export default AudioStore;
