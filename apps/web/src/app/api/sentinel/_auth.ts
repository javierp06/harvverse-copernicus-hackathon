import { timingSafeEqual } from "node:crypto";

import { env } from "@harvverse-copernicus-hackathon/env/server";

function constantTimeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function requestSecret(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer ?? request.headers.get("x-sentinel-agent-key") ?? null;
}

export function requireSentinelAgentRequest(request: Request) {
  const expected = env.SENTINEL_AGENT_API_KEY;
  if (!expected && env.NODE_ENV !== "production") return null;

  if (!expected) {
    return Response.json(
      {
        ok: false,
        error: "SENTINEL_AGENT_API_KEY must be configured before Sentinel endpoints are exposed.",
      },
      { status: 503 },
    );
  }

  const provided = requestSecret(request);
  if (provided != null && constantTimeEqual(provided, expected)) return null;

  return Response.json(
    {
      ok: false,
      error: "Invalid or missing Sentinel agent API key.",
    },
    { status: 401 },
  );
}
