export interface SentinelHubCredentials {
  clientId: string;
  clientSecret: string;
}

const SENTINEL_HUB_TOKEN_URL =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
export const SENTINEL_HUB_STATS_URL =
  "https://sh.dataspace.copernicus.eu/api/v1/statistics";

export function getSentinelHubCredentials(env: {
  SENTINEL_HUB_CLIENT_ID?: string;
  SENTINEL_HUB_CLIENT_SECRET?: string;
}): SentinelHubCredentials | null {
  if (!env.SENTINEL_HUB_CLIENT_ID || !env.SENTINEL_HUB_CLIENT_SECRET) {
    return null;
  }

  return {
    clientId: env.SENTINEL_HUB_CLIENT_ID,
    clientSecret: env.SENTINEL_HUB_CLIENT_SECRET,
  };
}

export async function getSentinelHubToken(
  credentials: SentinelHubCredentials,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });

  const response = await fetch(SENTINEL_HUB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `Sentinel Hub auth failed: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Sentinel Hub auth response did not include an access token.");
  }

  return data.access_token;
}
