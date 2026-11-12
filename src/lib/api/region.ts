import { DataProcessingRegion } from "../transport/plugins/plugin";

export const DEFAULT_REGION: DataProcessingRegion = "us";

// journify.io is production, journify.dev is staging.
export const JOURNIFY_DOMAINS = ["journify.io", "journify.dev"];
const DEFAULT_DOMAIN = "journify.io";

const REGION_SUBDOMAINS: Record<DataProcessingRegion, string> = {
  us: "t",
  eu: "t-eu",
  ksa: "t-ksa",
};

export function getRegionApiHosts(
  domain: string = DEFAULT_DOMAIN
): Record<DataProcessingRegion, string> {
  const hosts = {} as Record<DataProcessingRegion, string>;
  for (const [region, subdomain] of Object.entries(REGION_SUBDOMAINS)) {
    hosts[region as DataProcessingRegion] = `https://${subdomain}.${domain}`;
  }
  return hosts;
}

export const REGION_API_HOSTS = getRegionApiHosts();

export const DEFAULT_API_HOST = REGION_API_HOSTS[DEFAULT_REGION];

/**
 * Returns the Journify domain (journify.io / journify.dev) of a regional API host,
 * or undefined if the host is not a Journify API host (e.g. a customer custom domain).
 */
function getApiHostDomain(apiHost: string): string | undefined {
  try {
    const { origin } = new URL(apiHost);
    return JOURNIFY_DOMAINS.find((domain) =>
      Object.values(getRegionApiHosts(domain)).includes(origin)
    );
  } catch {
    return undefined;
  }
}

export function isJournifyAPIHost(apiHost: string): boolean {
  return getApiHostDomain(apiHost) === DEFAULT_DOMAIN;
}

/**
 * Priority: customer custom domain > dashboard region > us (default).
 * The environment (prod / staging) is taken from the local Journify apiHost, and defaults to prod.
 */
export function resolveApiHost(localApiHost?: string, region?: string): string {
  let domain = DEFAULT_DOMAIN;
  if (localApiHost) {
    const localDomain = getApiHostDomain(localApiHost);
    if (!localDomain) {
      return localApiHost;
    }
    domain = localDomain;
  }

  const hosts = getRegionApiHosts(domain);
  const key = region?.trim().toLowerCase() as DataProcessingRegion;
  return hosts[key] ?? hosts[DEFAULT_REGION];
}
