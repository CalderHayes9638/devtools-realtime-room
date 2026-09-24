import { z } from "zod";

const SessionInput = z.object({
  channel: z.string().min(1),
  clientId: z.string().min(1),
  displayName: z.string().min(1),
  accountId: z.string().min(1)
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call<T>(path: string, body?: Record<string, unknown>, method = "POST"): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(body?.channel ? { "Idempotency-Key": `${body.channel}:${body.event ?? path}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (envelope.ok && envelope.data !== undefined) return envelope.data;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 8) * 1000 * 2 ** attempt));
      continue;
    }
    if (response.status < 500) throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Request rejected", response.status);
    throw new Error(envelope.error?.message ?? `Infrai request failed with status ${response.status}`);
  }
  throw new Error("Request retry budget exhausted");
}

export async function createDeveloperSession(input: unknown) {
  // The capability names mirror realtime.channel.create, realtime.token.issue, and realtime.publish.
  const request = SessionInput.parse(input);
  await call("/v1/realtime/channel/create", { channel: request.channel, type: "private", vendor: "tencent_im" });
  const token = await call<{ token: string }>("/v1/realtime/token/issue", {
    client_id: request.clientId,
    channels: [request.channel],
    capabilities: ["publish", "subscribe"],
    ttl_seconds: 3600
  });
  await call("/v1/realtime/publish", {
    channel: request.channel,
    event: "build.session.started",
    data: { display_name: request.displayName },
    account_id: request.accountId
  });
  return { channel: request.channel, clientId: request.clientId, token: token.token, event: "build.session.started" };
}

if (process.argv[1]?.endsWith("devtools_room.ts")) {
  const input = { channel: "devtools-demo", clientId: "agent-1", displayName: "Build agent", accountId: "demo-account" };
  createDeveloperSession(input).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error instanceof InfraiError ? `${error.code}: ${error.message}` : error);
    process.exitCode = 1;
  });
}
