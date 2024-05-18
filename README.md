# Scoopika

[Documentation](https://docs.scoopika.com/packages/ts/scoopika) | [Github repo](https://github.com/scoopika/scoopika)

This package is used to:

1. Run AI agents and multi-agent boxes.

2. Manage chat and history sessions.

3. Equip agents with external tools & custom functions.

4. Extract structured data using agents.

5. Go crazy and pass agents as tools to other agents so they can call each other.

6. Stream responses with built-in streaming hooks.

7. Built-in support for vision (and soon sound and videos).

and much more... check the [docs](https://docs.scoopika.com/packages/ts/scoopika) for more info.

## Usage

To use this package, you first need to create a Scoopika account [here](https://scoopika.com/login). after that you can create agents and run them.

Also make sure to generate an access token from [here](https://scoopika.com/app/settings?tab=token).

```typescript
import { Scoopika, Agent } from "@scoopika/scoopika";

const scoopika = new Scoopika({
  token: "YOUR_SCOOPIKA_TOKEN",
  engines: {
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
