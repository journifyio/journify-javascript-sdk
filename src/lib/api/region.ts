import { DataProcessingRegion } from "../transport/plugins/plugin";

export const DEFAULT_REGION: DataProcessingRegion = "us";

export const REGION_API_HOSTS: Record<DataProcessingRegion, string> = {
  us: "https://t.journify.io",
  eu: "https://t-eu.journify.io",
  ksa: "https://t-ksa.journify.io",
};

export const DEFAULT_API_HOST = REGION_API_HOSTS[DEFAULT_REGION];

export function isJournifyAPIHost(apiHost: string): boolean {
  try {
    const origin = new URL(apiHost).origin;
    return Object.values(REGION_API_HOSTS).some(
      (host) => new URL(host).origin === origin
    );
  } catch {
    return false;
  }
}

/**
 * Priority: customer custom domain > dashboard region > us (default).
 */
export function resolveApiHost(localApiHost?: string, region?: string): string {
  if (localApiHost && !isJournifyAPIHost(localApiHost)) {
    return localApiHost;
  }
  const key = region?.trim().toLowerCase() as DataProcessingRegion;
  return REGION_API_HOSTS[key] ?? DEFAULT_API_HOST;
}
