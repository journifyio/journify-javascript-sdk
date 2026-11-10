const GOOGLE_TAG_SCRIPT_URL = "https://www.googletagmanager.com/gtag/js";

// Returns the URL to load gtag.js from.
// With Google tag gateway for advertisers, the tag is served from a path on the
// site's own domain (e.g. "/metrics") that the customer's CDN proxies to Google.
// The proxy already knows which tag it serves, so the URL carries no tag ID.
// Docs: https://developers.google.com/tag-platform/tag-manager/gateway/setup-guide
export function googleTagScriptURL(opts: {
  tagID: string;
  gatewayPath?: string;
  dataLayerName?: string;
}): string {
  const gatewayURL = toGatewayURL(opts.gatewayPath);
  const query = new URLSearchParams();
  if (!gatewayURL) {
    query.set("id", opts.tagID);
  }
  if (opts.dataLayerName) {
    query.set("l", opts.dataLayerName);
  }

  const queryString = query.toString();
  const baseURL = gatewayURL || GOOGLE_TAG_SCRIPT_URL;
  return queryString ? `${baseURL}?${queryString}` : baseURL;
}

// Turns a gateway path like "metrics", "/metrics" or "/metrics/" into "/metrics/".
// Absolute URLs are kept as they are. Returns an empty string when no usable
// path is set, so the tag is loaded from Google's domain.
function toGatewayURL(gatewayPath?: string): string {
  const trimmed = (gatewayPath || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return `${trimmed}/`;
  }

  return `/${trimmed.replace(/^\/+/, "")}/`;
}
