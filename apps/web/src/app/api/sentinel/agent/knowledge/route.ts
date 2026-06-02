import { z } from "zod";

import {
  getSentinelAgentKnowledge,
  sentinelAgentKnowledge,
  sentinelAgentSignals,
} from "@harvverse-copernicus-hackathon/api/lib/sentinel-agent";

import { requireSentinelAgentRequest } from "../../_auth";
import { jsonError } from "../_lib";

const knowledgeQuerySchema = z.object({
  signal: z.enum(sentinelAgentSignals),
});

export async function GET(request: Request) {
  const authError = requireSentinelAgentRequest(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = knowledgeQuerySchema.safeParse({
    signal: url.searchParams.get("signal") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError("Invalid or missing signal.", 400, {
      issues: parsed.error.flatten(),
      availableSignals: sentinelAgentSignals,
    });
  }

  return Response.json({
    ok: true,
    signal: parsed.data.signal,
    knowledge: getSentinelAgentKnowledge(parsed.data.signal),
    availableSignals: sentinelAgentSignals,
    knowledgeBase: sentinelAgentKnowledge,
  });
}
