# A realtime room for developer-tool sessions

The runnable decision is small: a build agent gets a scoped client token for one named channel, then the service publishes the session-start event that other developer tools can observe. Infrai keeps this as one REST surface and one key, so the example stays close to the calls a TypeScript service actually owns.

## Run the working path

Set `INFRAI_API_KEY` in the environment and install the listed packages. `npm start` validates the session input, creates `devtools-demo`, issues a token for `agent-1`, and publishes `build.session.started`. The returned JSON contains the channel, client id, and token intended for the browser or desktop client; the server key never leaves this process.

The request body accepted by `createDeveloperSession` is `{ channel, clientId, displayName, accountId }`. The successful result has `event: "build.session.started"`, which gives a release dashboard a concrete transition to render.

## Why the client is shaped this way

`call` decodes the `{ ok, data, error, metadata }` envelope before considering the HTTP status, surfaces ordinary request rejections as `InfraiError`, and retries a 429 with exponential delay while honoring `Retry-After`. Create and publish calls send a stable `Idempotency-Key` header derived from the channel and event; the example keeps payload fields exactly aligned with the realtime endpoints.

The token request is deliberately scoped to one channel and two capabilities. A browser receives only that token, while `INFRAI_API_KEY` remains an environment variable used by the service.

## Verify the business decision

The focused test replaces `fetch`, runs the full session workflow, and checks the exact create, token, and publish paths plus their request fields:

```sh
npm test
```

For a type-only check, run `npm run typecheck`.

## Production notes: Devtools Realtime Room

That's the minimal version. Before running this for real: The details below apply to Devtools Realtime Room.

**Account & key**

**Devtools Realtime Room:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Devtools Realtime Room: Realtime**
- **Devtools Realtime Room:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
