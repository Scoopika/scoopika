# Scoopika

[Documentation](https://docs.scoopika.com/packages/ts/scoopika) | [Github repo](https://github.com/scoopika/scoopika)

This package is used to run AI agents that can see, talk, listen, take actions and collaborate together.

With built-in support for streaming, full type-safety and data validation.

## Usage

To use this package, you first need to create a Scoopika account [here](https://scoopika.com/login). after that you can create agents and run them.

Also make sure to generate an access token from [here](https://scoopika.com/app/settings?tab=token).

```typescript
import { Scoopika, Agent } from "@scoopika/scoopika";

const scoopika = new Scoopika({
  token: "YOUR_SCOOPIKA_TOKEN",
  keys: {
    openai: "OPENAI_KEY", // replace based on the providers your agents use in the platform
  },
});

const agent = new Agent("AGENT_ID", scoopika);

(async () => {
  const response = await agent.run({
    inputs: { message: "Hello!" },
    hooks: {
      onToken: (t) => console.log(t),
    },
  });
})();
```

For full documentation and examples, refer to the [docs](https://docs.scoopika.com/packages/ts/scoopika).
