import { BoxHooks, HookArrays, HooksClass } from "@scoopika/types";

class Hooks implements HooksClass {
  hooks: HookArrays = {
    onStream: [],
    onToken: [],
    onAudio: [],
    onError: [],
    onStart: [],
    onFinish: [],
    onOutput: [],
    onToolCall: [],
    onToolResult: [],
    onBoxFinish: [],
    onAgentResponse: [],
    onSelectAgent: [],
    onClientSideAction: [],
  };

  constructor(hooks?: HookArrays) {
    if (hooks) this.hooks = hooks;
  }

  addHook<K extends keyof BoxHooks>(type: K, func: BoxHooks[K]) {
    this.hooks[type].push(func);
  }

  addRunHooks(hooks: BoxHooks) {
    const keys = Object.keys(hooks) as (keyof BoxHooks)[];
    for (const key of keys) {
      const func = hooks[key];
      this.addHook(key, func);
    }
  }

  async executeHook<K extends keyof BoxHooks>(
    key: K,
    data: Parameters<NonNullable<BoxHooks[K]>>[0],
  ) {
    const hooks = this.hooks[key];

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

export default Hooks;
