# Scoopika

Scoopika is a platform packed with all the tools needed to build reliable Multimodal AI-powered applications utilizing LLMs and AI agents. perfect for creating conversational AI assistants and data extraction.

[Check Documentation](https://docs.scoopika.com)

[Platform website](https://scoopika.com)



## What is the goal of this project?

The goal of this project is to make it easy for web developers to build Multimodal reliable, fast, and interactive AI-powered applications easily without wasting days on technical details.



## What will you get?

- **Platform** [link](https://scoopika.com): A web-based to create AI agents and more:
  - **AI agents**: Connect your LLMs providers and create AI agents, that can be used as conversational assistance or for data extraction. can accept Multimodal inputs and return text, voice, or JSON objects as a response based on what you want it to do.
  - **Memory stores**: Create Serverless encrypted managed databases to store conversations just by passing sessions IDs and users IDs in the easiest way possible.
  - **Knowledge stores**: Create Serverless knowledge stores (managed vector databases), and upload files, PDFs, or add websites URLs to expand your AI agents knowledge. (uses RAG under the hood).
- **SDKs**: SDKs to run AI agents for different use cases on the server-side, client-side, and specific libraries like React.
  - **core** ([@scoopika/scoopika](https://npmjs.com/package/@scoopika/scoopika)): Used to run AI agents on the server-side with APIs to manage conversations sessions and more. when building a web applications you'll use this sdk to run a Scoopika endpoint, a simple API endpoint used with built-in support for streaming and caching so you can simply use the Scoopika client library with it.
  - **client** (@scoopika/client): Used to run AI agents on the client-side, with building blocks to help you with voice-based AI interfaces like a voice recorder with speech recognition, an AI agent voice player in real-time, both with visualizers similar to the ones you see in OpenAI's gpt-4o. This library requires a running Scoopika endpoint to work.
  - **react** ([@scoopika/react](https://npmjs.com/package/@scoopika/react)): A library to easily build interactive AI chat interfaces with state management and React hooks. the playground you see in the Scoopika platform [here](https://app.scoopika.com/playground) was actually built using this library.

You can find documentation for each SDK [here](https://docs.scoopika.com/packages).

## Development

This project is currently stable enough to be used in live applications, we actually use it in our own production [playground](https://app.scoopika.com/playground). with that being said, a lot of features are still yet to come:

- [ ] Video inputs.
- [ ] Faster audio recognition.
- [ ] Files inputs (Text and PDF).
- [ ] Anthropic LLMs (High priority).
- [ ] Templates & videos (ongoing process).
- [ ] Ready to use tools (3rd-party integrations) that can be added to AI agents.
- [ ] Better error handling in the client-side voice recorder.



## Contributing

Contributions to Scoopika are welcome and highly appreciated. please notice that this project is building built by one person, so you won't find comments and docs for everything, I'm doing my best to document the files but it might take me a while to finish it, if you want to help documenting the code please dm me on [twitter](https://x.com/kais_rad).

Please read the [Contribution Guidelines](https://github.com/scoopika/scoopika/blob/main/CONTRIBUTING.md) before jumping into it.

Notice that the platform is not included in this repository and has it's own found [here](https://github.com/scoopika/web) and [here](https://github.com/kais-radwan/scoopika-app).



## Authors

Created with love and respect by Kais Radwan ([@kais_rad](https://x.com/kais_rad)).

