import { HookArrays, Hooks, HooksHub } from "@scoopika/types";

export class Hookshub implements HooksHub {
  hooks: HookArrays = {
    onStream: [],
    onToken: [],
    onAudio: [],
    onStart: [],
    onFinish: [],
    onOutput: [],
    onToolCall: [],
    onToolResult: [],
    onModelResponse: [],
    onClientSideAction: [],
    onJson: [],
  };

  constructor(hooks?: HookArrays) {
    if (hooks) this.hooks = hooks;
  }

  addHook<K extends keyof Hooks>(type: K, func: Hooks[K]) {
    if (!this.hooks[type]) {
      console.error(`Hook ${type} is not supported!`);
      return;
    }
    this.hooks[type].push(func);
  }

  addRunHooks(hooks: Hooks) {
    const keys = Object.keys(hooks) as (keyof Hooks)[];
    for (const key of keys) {
      const func = hooks[key];
      this.addHook(key, func);
    }
  }

  async executeHook<K extends keyof Hooks>(
    key: K,
    data: Parameters<NonNullable<Hooks[K]>>[0],
  ) {
    const hooks = this.hooks[key];

    if (!hooks) {
      console.error(`Hooks with type ${key} are not found!`);
      return;
    }

    for await (const hook of hooks) {
      if (!hook) continue;

      try {
        await hook(data as any);
      } catch (err) {
        console.error(err);
      }
    }
  }
}
