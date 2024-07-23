# Scoopika Client Tests

There are two types of tests for the Scoopika client.

## Vitest

Will test the client in a Node environment.

The tests will try to connect to a sevrer running Scoopika container, there's a `server.ts` that you can run in order to run the tests. just make sure to have your variables in the `.env` file:

`SCOOPIKA_TOKEN`: Your Scoopika access token.
`FIREWORKS_TOKEN`: Your Fireworks token. if you use another provider just provide the key you want to edit the `server.ts` to use it.
`AGENT_ID`: The ID of the agent to run the tests on.

Optional:

`BOX_ID`: The box ID to run the tests on.
`STORE_URL`: A remote history store to test with a remote store in place.

Step1:

```bash
npm run testserver
```

Step2:

```bash
npm run test
```

## Playwright

Will test the client in a web browser environment with the `index.global.js`.

Make sure to build the client before running this test:

```bash
make b
```

or:

```bash
npm run build
```

Make sure to edit the `tests/web/test.html` file to include your own agent and box IDs and make sure they are the same IDs running in the test Scoopika server.

Step1:

```bash
npm run testserver
```

Step2:

```bash
npm run httpserver
```

Step3:

```bash
npm run e2e
```
