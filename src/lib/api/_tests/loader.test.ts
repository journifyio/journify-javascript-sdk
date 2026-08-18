import { Loader } from "../loader";
import { ResolvedSdkConfig } from "../../lib/remoteConfig";
import { AutoCapturePII } from "../../lib/autoCapturePII";

const validWriteKey = `wk_${"a".repeat(27)}`;

describe("Loader reload behavior", () => {
  const sentryWrapper = {
    captureException: jest.fn(),
    setTag: jest.fn(),
    setResponse: jest.fn(),
    captureMessage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("keeps the same SDK instance while refreshing hashing behavior on reload", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as typeof fetch;
    const loader = new Loader(sentryWrapper as never);

    const sdk = await loader.load(
      { writeKey: validWriteKey },
      { syncs: [] },
      buildResolvedConfig({ hashingEnabled: false })
    );
    const firstPlugin = (loader as never as { plugins: { journifyio: { track: unknown } } })
      .plugins.journifyio;

    const reloadedSdk = await loader.load(
      { writeKey: validWriteKey },
      { syncs: [] },
      buildResolvedConfig({ hashingEnabled: true })
    );
    const secondPlugin = (loader as never as {
      plugins: {
        journifyio: {
          track: (ctx: unknown) => Promise<unknown>;
          resolvedConfig: ResolvedSdkConfig;
        };
      };
    }).plugins.journifyio;
    const secondTrackSpy = jest.spyOn(secondPlugin, "track");

    await reloadedSdk.track("Purchase", undefined, { email: "user@example.com" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(reloadedSdk).toBe(sdk);
    expect(secondPlugin).not.toBe(firstPlugin);
    expect(secondPlugin.resolvedConfig.hashing.enabled).toBe(true);
    expect(secondTrackSpy).toHaveBeenCalled();
  });

  it("refreshes the auto-capture listener lifecycle and field allowlist on reload", async () => {
    const addEventListenerSpy = jest.spyOn(document.body, "addEventListener");
    const removeEventListenerSpy = jest.spyOn(document.body, "removeEventListener");
    const loader = new Loader(sentryWrapper as never);

    await loader.load(
      { writeKey: validWriteKey },
      { syncs: [] },
      buildResolvedConfig({
        autoCaptureEnabled: true,
        autoCaptureFields: ["phone"],
      })
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
      { capture: true }
    );
    expect(
      Array.from(((loader as never as { autoCapturePII: AutoCapturePII }).autoCapturePII as never as {
        enabledFields: Set<string>;
      }).enabledFields)
    ).toEqual(["phone"]);

    await loader.load(
      { writeKey: validWriteKey },
      { syncs: [] },
      buildResolvedConfig({
        autoCaptureEnabled: true,
        autoCaptureFields: ["email"],
      })
    );

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
      { capture: true }
    );
    expect(
      Array.from(((loader as never as { autoCapturePII: AutoCapturePII }).autoCapturePII as never as {
        enabledFields: Set<string>;
      }).enabledFields)
    ).toEqual(["email"]);

    await loader.load(
      { writeKey: validWriteKey },
      { syncs: [] },
      buildResolvedConfig({ autoCaptureEnabled: false })
    );

    expect(removeEventListenerSpy).toHaveBeenCalledTimes(2);
    expect((loader as never as { autoCapturePII: AutoCapturePII | null }).autoCapturePII).toBeNull();
  });
});

function buildResolvedConfig({
  hashingEnabled = false,
  autoCaptureEnabled = false,
  autoCaptureFields = [],
}: {
  hashingEnabled?: boolean;
  autoCaptureEnabled?: boolean;
  autoCaptureFields?: string[];
}): ResolvedSdkConfig {
  return {
    hashing: {
      enabled: hashingEnabled,
      algorithm: "sha256",
      additionalPIIKeys: [],
    },
    autoCapturePII: {
      enabled: autoCaptureEnabled,
      fields: autoCaptureFields as ResolvedSdkConfig["autoCapturePII"]["fields"],
    },
    cookieKeeper: {
      enabled: false,
    },
  };
}
