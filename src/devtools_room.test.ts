import assert from "node:assert/strict";
import { createDeveloperSession } from "./devtools_room.js";

const originalFetch = globalThis.fetch;
const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
globalThis.fetch = async (url, init) => {
  const path = new URL(String(url)).pathname;
  const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
  calls.push({ path, body });
  const data = path.endsWith("token/issue") ? { token: "session-token" } : {};
  return new Response(JSON.stringify({ ok: true, data, metadata: {} }), { status: 200, headers: { "Content-Type": "application/json" } });
};
process.env.INFRAI_API_KEY = "test-key";

const result = await createDeveloperSession({ channel: "build-42", clientId: "agent-7", displayName: "CI agent", accountId: "acct-1" });
assert.equal(result.event, "build.session.started");
assert.equal(calls[0].path, "/v1/realtime/channel/create");
assert.deepEqual(calls[0].body, { channel: "build-42", type: "private", vendor: "tencent_im" });
assert.equal(calls[1].path, "/v1/realtime/token/issue");
assert.equal(calls[2].path, "/v1/realtime/publish");
assert.deepEqual(calls[2].body, { channel: "build-42", event: "build.session.started", data: { display_name: "CI agent" }, account_id: "acct-1" });
globalThis.fetch = originalFetch;
console.log("session workflow boundary test passed");
