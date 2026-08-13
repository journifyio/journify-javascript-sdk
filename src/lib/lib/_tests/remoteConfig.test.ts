import {
  AUTO_CAPTURE_PII_SUPPORTED_FIELDS,
  buildWriteKeySettingsUrl,
  RemoteConfig,
} from "../remoteConfig";
import { RemoteOptions, SdkOptions } from "../../transport/plugins/plugin";

describe("RemoteConfig", () => {
  const sentry = {
    captureException: jest.fn(),
    setResponse: jest.fn().mockResolvedValue(undefined),
    setTag: jest.fn(),
  };
  const consoleWarn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("builds the write key settings URL with a normalized cdnHost", () => {
    expect(
      buildWriteKeySettingsUrl("https://custom.cdn.example///", "wk_abc")
    ).toBe("https://custom.cdn.example/write_keys/wk_abc.json");
  });

  it("fetches and parses remote config options", async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createResponse({
        status: 200,
        jsonBody: {
          syncs: [{ id: "sync-1" }],
          addons: [
            {
              name: "end2end_hashing",
              options: {
                algorithm: "sha256",
              },
            },
          ],
        },
        headers: {
          "X-Client-Country": "US",
        },
      })
    );

    const remoteConfig = new RemoteConfig({ fetchFn, sentry, consoleWarn });
    const result = await remoteConfig.load("wk_abc", "https://static.journify.io", {
      enableHashing: false,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://static.journify.io/write_keys/wk_abc.json",
      expect.any(Object)
    );
    expect(result.writeKeySettings.country_code).toBe("US");
    expect(result.writeKeySettings.syncs).toEqual([{ id: "sync-1" }]);
    expect(result.writeKeySettings.addons).toEqual([
      {
        name: "end2end_hashing",
        options: {
          algorithm: "sha256",
        },
      },
    ]);
    expect(result.resolvedConfig.hashing).toEqual({
      enabled: true,
      algorithm: "sha256",
      additionalPIIKeys: [],
    });
  });

  it("applies precedence remote over local over defaults based on addon presence", () => {
    const localOptions: SdkOptions = {
      enableHashing: true,
      additionalPIIKeys: ["company"],
      autoCapturePII: true,
      httpCookieServiceOptions: {
        renewUrl: "/renew",
        enablePolling: false,
      },
    };
    const remoteConfig = new RemoteConfig({
      fetchFn: jest.fn(),
      sentry,
      consoleWarn,
    });

    const resolved = remoteConfig.resolveConfig(
      {
        hashing: { algorithm: "sha256" },
        auto_capture_pii: { fields: ["email", "phone"] },
        cookie_keeper: {},
      },
      localOptions
    );

    expect(resolved.hashing).toEqual({
      enabled: true,
      algorithm: "sha256",
      additionalPIIKeys: ["company"],
    });
    expect(resolved.autoCapturePII).toEqual({
      enabled: true,
      fields: ["email", "phone"],
    });
    expect(resolved.cookieKeeper).toEqual({
      enabled: true,
      options: {
        renewUrl: "/renew",
        enablePolling: true,
      },
    });
    expect(consoleWarn).toHaveBeenCalledTimes(3);
  });

  it("falls back safely when remote values are malformed", () => {
    const remoteConfig = new RemoteConfig({
      fetchFn: jest.fn(),
      sentry,
      consoleWarn,
    });

    const resolved = remoteConfig.resolveConfig(
      ({
        hashing: { algorithm: "md5" },
        auto_capture_pii: { fields: [123, "email"] },
        cookie_keeper: {},
      } as unknown) as RemoteOptions,
      {
        enableHashing: true,
        autoCapturePII: true,
        httpCookieServiceOptions: { renewUrl: "/renew" },
      }
    );

    expect(resolved.hashing.enabled).toBe(true);
    expect(resolved.hashing.algorithm).toBe("sha256");
    expect(resolved.autoCapturePII).toEqual({
      enabled: true,
      fields: ["email"],
    });
    expect(resolved.cookieKeeper).toEqual({
      enabled: true,
      options: {
        renewUrl: "/renew",
        enablePolling: true,
      },
    });
  });

  it("uses default auto-capture fields when remote fields are missing or empty", () => {
    const remoteConfig = new RemoteConfig({
      fetchFn: jest.fn(),
      sentry,
      consoleWarn,
    });

    const missingFields = remoteConfig.resolveConfig(
      {
        auto_capture_pii: {},
      },
      {}
    );
    const emptyFields = remoteConfig.resolveConfig(
      {
        auto_capture_pii: { fields: [] },
      },
      {}
    );

    expect(missingFields.autoCapturePII.fields).toEqual(
      [...AUTO_CAPTURE_PII_SUPPORTED_FIELDS]
    );
    expect(emptyFields.autoCapturePII.fields).toEqual(
      [...AUTO_CAPTURE_PII_SUPPORTED_FIELDS]
    );
  });

  it("disables remote cookie keeper safely when renewUrl is missing", () => {
    const remoteConfig = new RemoteConfig({
      fetchFn: jest.fn(),
      sentry,
      consoleWarn,
    });

    const resolved = remoteConfig.resolveConfig(
      {
        cookie_keeper: {},
      },
      {
        httpCookieServiceOptions: {
          renewUrl: "   ",
        },
      }
    );

    expect(resolved.cookieKeeper).toEqual({ enabled: false });
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("Remote cookie_keeper is enabled")
    );
  });

  it("retries failed requests up to the configured limit and falls back on network errors", async () => {
    jest.useFakeTimers();
    const fetchFn = jest
      .fn()
      .mockRejectedValueOnce(new Error("network-1"))
      .mockRejectedValueOnce(new Error("network-2"))
      .mockResolvedValueOnce(
        createResponse({
          status: 200,
          jsonBody: {
            syncs: [],
            addons: [{ name: "end2end_hashing" }],
          },
        })
      );
    const remoteConfig = new RemoteConfig({ fetchFn, sentry, consoleWarn });

    const promise = remoteConfig.load("wk_abc", "https://static.journify.io");
    await jest.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(result.resolvedConfig.hashing.enabled).toBe(true);
  });

  it("times out within the initialization budget and falls back to local config", async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn().mockImplementation(() => new Promise(() => undefined));
    const remoteConfig = new RemoteConfig({ fetchFn, sentry, consoleWarn });

    const promise = remoteConfig.load("wk_abc", "https://static.journify.io", {
      autoCapturePII: true,
    });
    await jest.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.writeKeySettings).toEqual({ syncs: [] });
    expect(result.resolvedConfig.autoCapturePII.enabled).toBe(true);
  });

  it("deduplicates concurrent requests and caches successful responses", async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createResponse({
        status: 200,
        jsonBody: {
          syncs: [],
          addons: [{ name: "end2end_hashing" }],
        },
      })
    );
    const remoteConfig = new RemoteConfig({ fetchFn, sentry, consoleWarn });

    const [first, second] = await Promise.all([
      remoteConfig.load("wk_abc", "https://static.journify.io"),
      remoteConfig.load("wk_abc", "https://static.journify.io/"),
    ]);
    const third = await remoteConfig.load("wk_abc", "https://static.journify.io");

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(first.resolvedConfig.hashing.enabled).toBe(true);
    expect(second.resolvedConfig.hashing.enabled).toBe(true);
    expect(third.resolvedConfig.hashing.enabled).toBe(true);
  });

  it("does not permanently cache failed requests", async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValueOnce(new Error("network-failure"))
      .mockResolvedValueOnce(
        createResponse({
          status: 200,
          jsonBody: {
            syncs: [],
          },
        })
      );
    const remoteConfig = new RemoteConfig({ fetchFn, sentry, consoleWarn });

    const first = await remoteConfig.load("wk_abc", "https://static.journify.io");
    const second = await remoteConfig.load("wk_abc", "https://static.journify.io");

    expect(first.writeKeySettings).toEqual({ syncs: [] });
    expect(second.writeKeySettings).toEqual({ syncs: [] });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("ignores unknown addons safely", async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createResponse({
        status: 200,
        jsonBody: {
          syncs: [],
          addons: [
            { name: "mystery_addon", options: { enabled: true } },
            { name: "end2end_hashing", options: { algorithm: "sha256" } },
          ],
        },
      })
    );
    const remoteConfig = new RemoteConfig({ fetchFn, sentry, consoleWarn });

    const result = await remoteConfig.load("wk_abc", "https://static.journify.io");

    expect(result.resolvedConfig.hashing.enabled).toBe(true);
    expect(result.resolvedConfig.autoCapturePII.enabled).toBe(false);
  });

  it("warns and falls back when remote config cannot be parsed", async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createResponse({
        status: 200,
        jsonError: new Error("malformed-json"),
      })
    );
    const remoteConfig = new RemoteConfig({ fetchFn, sentry, consoleWarn });

    const result = await remoteConfig.load("wk_abc", "https://static.journify.io", {
      enableHashing: true,
    });

    expect(result.writeKeySettings).toEqual({ syncs: [] });
    expect(result.resolvedConfig.hashing.enabled).toBe(true);
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("Remote config could not be fetched or parsed")
    );
  });
});

function createResponse({
  status,
  jsonBody,
  jsonError,
  textBody,
  headers = {},
}: {
  status: number;
  jsonBody?: unknown;
  jsonError?: Error;
  textBody?: string;
  headers?: Record<string, string>;
}): Response {
  const response: Partial<Response> = {
    ok: status >= 200 && status <= 299,
    status,
    headers: new Headers(headers),
    json: jsonError
      ? jest.fn().mockRejectedValue(jsonError)
      : jest.fn().mockResolvedValue(jsonBody),
    text: jest.fn().mockResolvedValue(textBody ?? JSON.stringify(jsonBody ?? {})),
  };

  return response as Response;
}
