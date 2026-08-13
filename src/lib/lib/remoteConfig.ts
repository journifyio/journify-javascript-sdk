import { HttpCookieOptions } from "./httpCookieService";
import { SentryWrapper } from "./sentry";
import {
  RemoteAddon,
  RemoteAutoCapturePIIOption,
  RemoteCookieKeeperOption,
  RemoteHashingOption,
  RemoteOptions,
  SdkOptions,
  WriteKeySettings,
} from "../transport/plugins/plugin";

export const DEFAULT_REMOTE_CONFIG_BUDGET_MS = 2000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 100;
const COUNTRY_HEADER = "X-Client-Country";
const HASHING_ALGORITHM_SHA256 = "sha256";
const JOURNIFY_PREFIX = "[Journify]";
const REMOTE_ADDON_END2END_HASHING = "end2end_hashing";
const REMOTE_ADDON_AUTO_CAPTURE_PII = "auto_capture_pii";
const REMOTE_ADDON_COOKIE_KEEPER = "cookie_keeper";

export const AUTO_CAPTURE_PII_SUPPORTED_FIELDS = [
  "email",
  "phone",
  "firstname",
  "lastname",
  "name",
  "gender",
  "birthday",
] as const;

export type AutoCapturePIIField =
  typeof AUTO_CAPTURE_PII_SUPPORTED_FIELDS[number];

export interface HashingConfig {
  enabled: boolean;
  algorithm: "sha256";
  additionalPIIKeys: string[];
}

export interface AutoCapturePIIConfig {
  enabled: boolean;
  fields: AutoCapturePIIField[];
}

export interface CookieKeeperConfig {
  enabled: boolean;
  options?: HttpCookieOptions;
}

export interface ResolvedSdkConfig {
  hashing: HashingConfig;
  autoCapturePII: AutoCapturePIIConfig;
  cookieKeeper: CookieKeeperConfig;
}

export interface RemoteConfigLoadResult {
  writeKeySettings: WriteKeySettings;
  resolvedConfig: ResolvedSdkConfig;
}

type RemoteLoadDependencies = {
  fetchFn?: typeof fetch;
  sentry: Pick<
    SentryWrapper,
    "captureException" | "setResponse" | "setTag"
  >;
  consoleWarn?: typeof console.warn;
};

export function createDefaultResolvedConfig(): ResolvedSdkConfig {
  return freezeResolvedConfig({
    hashing: {
      enabled: false,
      algorithm: HASHING_ALGORITHM_SHA256,
      additionalPIIKeys: [],
    },
    autoCapturePII: {
      enabled: false,
      fields: getDefaultAutoCapturePIIFields(),
    },
    cookieKeeper: {
      enabled: false,
    },
  });
}

export class RemoteConfig {
  private readonly fetchFn?: typeof fetch;
  private readonly sentry: RemoteLoadDependencies["sentry"];
  private readonly consoleWarn: typeof console.warn;
  private readonly responseCache = new Map<string, WriteKeySettings>();
  private readonly inFlightRequests = new Map<string, Promise<WriteKeySettings>>();

  constructor(deps: RemoteLoadDependencies) {
    this.fetchFn = deps.fetchFn;
    this.sentry = deps.sentry;
    this.consoleWarn = deps.consoleWarn ?? console.warn;
  }

  public async load(
    writeKey: string,
    cdnHost: string,
    localOptions?: SdkOptions
  ): Promise<RemoteConfigLoadResult> {
    const settingsUrl = buildWriteKeySettingsUrl(cdnHost, writeKey);
    const remoteSettings = await this.fetchWriteKeySettings(settingsUrl);
    const writeKeySettings = remoteSettings ?? { syncs: [] };

    if (!remoteSettings) {
      this.consoleWarn(
        `${JOURNIFY_PREFIX} Remote config could not be fetched or parsed for write key ${writeKey}. Falling back to legacy local config and SDK defaults.`
      );
    }

    return {
      writeKeySettings,
      resolvedConfig: freezeResolvedConfig(
        this.resolveConfig(writeKeySettings.options, localOptions)
      ),
    };
  }

  public resolveConfig(
    remoteOptions: RemoteOptions | undefined,
    localOptions?: SdkOptions
  ): ResolvedSdkConfig {
    return {
      hashing: this.resolveHashing(remoteOptions, localOptions),
      autoCapturePII: this.resolveAutoCapturePII(remoteOptions, localOptions),
      cookieKeeper: this.resolveCookieKeeper(remoteOptions, localOptions),
    };
  }

  private async fetchWriteKeySettings(
    settingsUrl: string
  ): Promise<WriteKeySettings | null> {
    const cachedResponse = this.responseCache.get(settingsUrl);
    if (cachedResponse) {
      return cachedResponse;
    }

    const inFlightRequest = this.inFlightRequests.get(settingsUrl);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = this.performBoundedFetch(settingsUrl)
      .then((settings) => {
        if (settings) {
          this.responseCache.set(settingsUrl, settings);
        }
        return settings;
      })
      .finally(() => {
        this.inFlightRequests.delete(settingsUrl);
      });

    this.inFlightRequests.set(settingsUrl, request);
    return request;
  }

  private async performBoundedFetch(
    settingsUrl: string
  ): Promise<WriteKeySettings | null> {
    const deadline = Date.now() + DEFAULT_REMOTE_CONFIG_BUDGET_MS;
    const controller = typeof AbortController !== "undefined"
      ? new AbortController()
      : undefined;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const request = this.fetchWithRetries(settingsUrl, deadline, controller?.signal);
    const timeout = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => {
        controller?.abort();
        resolve(null);
      }, DEFAULT_REMOTE_CONFIG_BUDGET_MS);
    });

    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async fetchWithRetries(
    settingsUrl: string,
    deadline: number,
    signal?: AbortSignal
  ): Promise<WriteKeySettings | null> {
    const fetchFn = this.getFetchFn();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (Date.now() >= deadline) {
        return null;
      }

      try {
        this.sentry.setTag("settingsURL", settingsUrl);
        const response = await fetchFn(settingsUrl, signal ? { signal } : undefined);
        if (response.ok) {
          const settings = await this.normalizeResponse(response);
          if (settings) {
            return settings;
          }
        } else {
          await this.handleNonOkResponse(settingsUrl, response);
        }
      } catch (error) {
        if (isAbortError(error)) {
          return null;
        }

        this.sentry.captureException(error);
      }

      if (attempt >= MAX_ATTEMPTS - 1) {
        return null;
      }

      const remainingTime = deadline - Date.now();
      if (remainingTime <= 0) {
        return null;
      }

      await sleep(Math.min(RETRY_DELAY_MS, remainingTime));
    }

    return null;
  }

  private getFetchFn(): typeof fetch {
    const fetchFn = this.fetchFn ?? globalThis.fetch;
    if (!fetchFn) {
      throw new Error("fetch is not available for RemoteConfig");
    }

    return fetchFn.bind(globalThis);
  }

  private async normalizeResponse(response: Response): Promise<WriteKeySettings | null> {
    let payload: unknown;

    try {
      payload = await response.json();
    } catch (error) {
      this.sentry.captureException(error);
      return null;
    }

    if (!isRecord(payload)) {
      return null;
    }

    const syncs = Array.isArray(payload.syncs) ? payload.syncs : [];
    const countryCode = response.headers?.get?.(COUNTRY_HEADER) ?? undefined;
    const consentMode = typeof payload.consent_mode === "string"
      ? payload.consent_mode
      : undefined;
    const addons = normalizeAddons(payload.addons);
    const options = addons ? normalizeAddonOptions(addons) : undefined;

    return {
      ...payload,
      syncs,
      consent_mode: consentMode,
      country_code: countryCode,
      addons,
      options,
    } as WriteKeySettings;
  }

  private async handleNonOkResponse(
    settingsUrl: string,
    response: Response
  ): Promise<void> {
    if (response.status === 404) {
      return;
    }

    const body = await response.text();
    const error = new Error(
      `write key settings request failed with status ${response.status}`
    );
    await this.sentry.setResponse({
      url: settingsUrl,
      headers: response.headers,
      status: response.status,
      body,
    });
    this.sentry.captureException(error);
  }

  private resolveHashing(
    remoteOptions: RemoteOptions | undefined,
    localOptions?: SdkOptions
  ): HashingConfig {
    const localConfigured = hasOwn(localOptions, "enableHashing");
    const remoteConfigured = hasOwn(remoteOptions, "hashing");

    if (remoteConfigured && (localConfigured || hasOwn(localOptions, "additionalPIIKeys"))) {
      this.warnRemoteWins(REMOTE_ADDON_END2END_HASHING, "enableHashing");
    }

    const additionalPIIKeys = sanitizeStringArray(localOptions?.additionalPIIKeys);
    const remoteHashing = remoteOptions?.hashing;

    if (remoteConfigured) {
      return {
        enabled: true,
        algorithm: getHashingAlgorithm(remoteHashing),
        additionalPIIKeys,
      };
    }

    return {
      enabled: localOptions?.enableHashing === true,
      algorithm: HASHING_ALGORITHM_SHA256,
      additionalPIIKeys,
    };
  }

  private resolveAutoCapturePII(
    remoteOptions: RemoteOptions | undefined,
    localOptions?: SdkOptions
  ): AutoCapturePIIConfig {
    const localConfigured = hasOwn(localOptions, "autoCapturePII");
    const remoteConfigured = hasOwn(remoteOptions, "auto_capture_pii");

    if (remoteConfigured && localConfigured) {
      this.warnRemoteWins("auto_capture_pii", "autoCapturePII");
    }

    const remoteAutoCapturePII = remoteOptions?.auto_capture_pii;
    if (remoteConfigured) {
      return {
        enabled: true,
        fields: normalizeAutoCapturePIIFields(remoteAutoCapturePII?.fields),
      };
    }

    return {
      enabled: localOptions?.autoCapturePII === true,
      fields: getDefaultAutoCapturePIIFields(),
    };
  }

  private resolveCookieKeeper(
    remoteOptions: RemoteOptions | undefined,
    localOptions?: SdkOptions
  ): CookieKeeperConfig {
    const localConfigured = hasOwn(localOptions, "httpCookieServiceOptions");
    const remoteConfigured = hasOwn(remoteOptions, "cookie_keeper");

    if (remoteConfigured && localConfigured) {
      this.warnRemoteWins("cookie_keeper", "httpCookieServiceOptions");
    }

    const localCookieOptions = normalizeCookieOptions(localOptions?.httpCookieServiceOptions);

    if (remoteConfigured) {
      if (!localCookieOptions) {
        this.consoleWarn(
          `${JOURNIFY_PREFIX} Remote cookie_keeper is enabled, but a valid legacy renewUrl is still required locally. Falling back to disabled cookie keeper.`
        );
        return { enabled: false };
      }

      return {
        enabled: true,
        options: {
          ...localCookieOptions,
          enablePolling: true,
        },
      };
    }

    if (!localCookieOptions) {
      return { enabled: false };
    }

    return {
      enabled: true,
      options: { ...localCookieOptions },
    };
  }

  private warnRemoteWins(remoteKey: string, legacyKey: string): void {
    this.consoleWarn(
      `${JOURNIFY_PREFIX} Remote configuration for "${remoteKey}" overrides legacy local option "${legacyKey}".`
    );
  }
}

export function buildWriteKeySettingsUrl(cdnHost: string, writeKey: string): string {
  const normalizedHost = normalizeCdnHost(cdnHost);
  return `${normalizedHost}/write_keys/${writeKey}.json`;
}

export function normalizeCdnHost(cdnHost: string): string {
  const host = cdnHost || "";
  let endIndex = host.length;

  while (endIndex > 0 && host.charAt(endIndex - 1) === "/") {
    endIndex -= 1;
  }

  return host.slice(0, endIndex);
}

function freezeResolvedConfig(config: ResolvedSdkConfig): ResolvedSdkConfig {
  return Object.freeze({
    hashing: Object.freeze({
      ...config.hashing,
      additionalPIIKeys: Object.freeze([...config.hashing.additionalPIIKeys]),
    }),
    autoCapturePII: Object.freeze({
      ...config.autoCapturePII,
      fields: Object.freeze([...config.autoCapturePII.fields]),
    }),
    cookieKeeper: Object.freeze(
      config.cookieKeeper.options
        ? {
            ...config.cookieKeeper,
            options: Object.freeze({ ...config.cookieKeeper.options }),
          }
        : { ...config.cookieKeeper }
    ),
  }) as ResolvedSdkConfig;
}

function getHashingAlgorithm(remoteHashing: RemoteHashingOption): "sha256" {
  if (remoteHashing.algorithm?.toLowerCase?.() === HASHING_ALGORITHM_SHA256) {
    return HASHING_ALGORITHM_SHA256;
  }

  return HASHING_ALGORITHM_SHA256;
}

function normalizeAutoCapturePIIFields(
  fields: RemoteAutoCapturePIIOption["fields"]
): AutoCapturePIIField[] {
  const normalizedFields = sanitizeStringArray(fields).filter(isAutoCapturePIIField);

  if (normalizedFields.length === 0) {
    return getDefaultAutoCapturePIIFields();
  }

  return normalizedFields.filter(
    (field, index) => normalizedFields.indexOf(field) === index
  ) as AutoCapturePIIField[];
}

function getDefaultAutoCapturePIIFields(): AutoCapturePIIField[] {
  return [...AUTO_CAPTURE_PII_SUPPORTED_FIELDS];
}

function isAutoCapturePIIField(value: string): value is AutoCapturePIIField {
  return AUTO_CAPTURE_PII_SUPPORTED_FIELDS.includes(value as AutoCapturePIIField);
}

function normalizeCookieOptions(
  options?: HttpCookieOptions
): HttpCookieOptions | undefined {
  if (!isRecord(options)) {
    return undefined;
  }

  const renewUrl = typeof options.renewUrl === "string"
    ? options.renewUrl.trim()
    : "";
  if (!renewUrl) {
    return undefined;
  }

  return {
    ...options,
    renewUrl,
  };
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAddons(value: unknown): RemoteAddon[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const addons: RemoteAddon[] = [];

  value.filter(isRecord).forEach((addon) => {
    const name = typeof addon.name === "string" ? addon.name.trim() : "";
    if (!name) {
      return;
    }

    addons.push({
      name,
      options: isRecord(addon.options)
        ? { ...addon.options }
        : undefined,
    });
  });

  return addons;
}

function normalizeAddonOptions(addons: RemoteAddon[]): RemoteOptions | undefined {
  const normalizedOptions: RemoteOptions = {};

  addons.forEach((addon) => {
    if (addon.name === REMOTE_ADDON_END2END_HASHING) {
      normalizedOptions.hashing = normalizeHashingOption(addon.options);
      return;
    }

    if (addon.name === REMOTE_ADDON_AUTO_CAPTURE_PII) {
      normalizedOptions.auto_capture_pii = normalizeAutoCapturePIIOption(addon.options);
      return;
    }

    if (addon.name === REMOTE_ADDON_COOKIE_KEEPER) {
      normalizedOptions.cookie_keeper = normalizeCookieKeeperOption();
    }
  });

  return Object.keys(normalizedOptions).length > 0
    ? normalizedOptions
    : undefined;
}

function normalizeHashingOption(
  options?: Record<string, unknown>
): RemoteHashingOption {
  return {
    algorithm: typeof options?.algorithm === "string"
      ? options.algorithm.trim()
      : undefined,
  };
}

function normalizeAutoCapturePIIOption(
  options?: Record<string, unknown>
): RemoteAutoCapturePIIOption {
  return {
    fields: Array.isArray(options?.fields) ? options.fields as string[] : undefined,
  };
}

function normalizeCookieKeeperOption(): RemoteCookieKeeperOption {
  return {};
}

function hasOwn(value: unknown, key: string): boolean {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function sleep(delayMS: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMS));
}
