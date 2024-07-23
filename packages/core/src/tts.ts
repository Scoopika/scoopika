import { VoiceResponse, HooksHub } from "@scoopika/types";
import { Scoopika, Voice } from "./scoopika";
import { sleep } from "./utils";

const PUNCTUATION = /([.?!;])/;

export class TTS {
  public scoopika: Scoopika;
  public chunks: VoiceResponse[] = [];
  public done_indexes: number[] = [];
  public hooksHub: HooksHub;
  public run_id: string;
  public voice?: Voice;
  public index: number = 0;
  public calls: number = 0;
  public failed: number = 0;
  public sentence: string = "";
  public later: string = "";
  public listeners: Record<number, () => any> = {};

  constructor({
    scoopika,
    hooksHub,
    run_id,
    voice,
  }: {
    scoopika: Scoopika;
    hooksHub: HooksHub;
    run_id: string;
    voice?: Voice;
  }) {
    this.scoopika = scoopika;
    this.run_id = run_id;
    this.voice = voice;
    this.hooksHub = hooksHub;
  }

  addChunk(chunk: VoiceResponse) {
    this.chunks.push(chunk);
    this.done_indexes.push(chunk.index);
    this.hooksHub.executeHook("onAudio", chunk);
    const listener = this.listeners[chunk.index];
    if (listener) listener();
  }

  queueChunk(chunk: VoiceResponse) {
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
    let match = this.sentence.match(PUNCTUATION);

    if (match) {
      const p = match[0];
      // Split only if it's a single dot, not multiple dots
      if (p === "." && this.sentence.match(/\.{2,}/)) {
        return;
      }
      const [prevSentence, newSentence] = this.sentence.split(p, 2);
      this.sentence = newSentence;
      this.generate(prevSentence + p);
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
      const id = await this.scoopika.generateAudioId(sentence, this.voice);
      const url = `${this.scoopika.getUrl()}/audio/read/${id}`;

      const chunk: VoiceResponse = {
        index: this_index,
        run_id: this.run_id,
        audio_id: id,
        read: url,
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
    this.hooksHub.addHook("onToken", (t) => handleToken(t));
  }
}
