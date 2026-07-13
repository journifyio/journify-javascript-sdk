import type { SdkSettings } from "@journifyio/js-sdk";

export const API_HOSTS = [
  "https://t.lvh.me",
  "https://t.journify.dev",
  "https://t.journify.io",
];

export const CDN_HOSTS = [
  "https://local.journify.dev",
  "https://static.journify.dev",
  "https://static.journify.io",
];

// Form state: everything is a string/boolean so inputs stay controlled;
// toSdkSettings() converts to the real SdkSettings shape.
export interface PlaygroundConfig {
  writeKey: string;
  apiHost: string;
  cdnHost: string;
  enableHashing: boolean;
  autoCapturePII: boolean;
  sessionDurationMin: string;
  cookieDomain: string;
  autoCapturePhoneRegex: string;
  phoneCountryCode: string;
  additionalPIIKeys: string; // comma-separated
  httpCookieServiceOptions: string; // JSON
  initialConsent: string; // JSON
}

export const DEFAULT_CONFIG: PlaygroundConfig = {
  writeKey: "",
  apiHost: API_HOSTS[0],
  cdnHost: CDN_HOSTS[0],
  enableHashing: false,
  autoCapturePII: false,
  sessionDurationMin: "",
  cookieDomain: "",
  autoCapturePhoneRegex: "",
  phoneCountryCode: "",
  additionalPIIKeys: "",
  httpCookieServiceOptions: "",
  initialConsent: "",
};

function parseJsonField(label: string, raw: string): object | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`${label} is not valid JSON: ${e}`);
  }
}

export function toSdkSettings(config: PlaygroundConfig): SdkSettings {
  const piiKeys = config.additionalPIIKeys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const httpCookieServiceOptions = parseJsonField(
    "httpCookieServiceOptions",
    config.httpCookieServiceOptions
  );
  const initialConsent = parseJsonField("initialConsent", config.initialConsent);

  return {
    writeKey: config.writeKey.trim(),
    apiHost: config.apiHost,
    cdnHost: config.cdnHost,
    options: {
      enableHashing: config.enableHashing,
      autoCapturePII: config.autoCapturePII,
      ...(piiKeys.length ? { additionalPIIKeys: piiKeys } : {}),
      ...(config.sessionDurationMin.trim()
        ? { sessionDurationMin: Number(config.sessionDurationMin) }
        : {}),
      ...(config.cookieDomain.trim()
        ? { cookie: { domain: config.cookieDomain.trim() } }
        : {}),
      ...(config.autoCapturePhoneRegex.trim()
        ? { autoCapturePhoneRegex: config.autoCapturePhoneRegex.trim() }
        : {}),
      ...(config.phoneCountryCode.trim()
        ? { phoneCountryCode: config.phoneCountryCode.trim() }
        : {}),
      ...(httpCookieServiceOptions ? { httpCookieServiceOptions } : {}),
      ...(initialConsent ? { initialConsent } : {}),
    },
  } as SdkSettings;
}
