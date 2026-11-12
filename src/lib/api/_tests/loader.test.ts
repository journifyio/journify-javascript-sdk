/* eslint-disable  @typescript-eslint/no-explicit-any */
import {randomUUID} from "node:crypto";
import {isValidWriteKey, Loader} from "../loader";
import {SentryWrapper} from "../../lib/sentry";
import {SdkSettings, Sync} from "../../transport/plugins/plugin";
import {UserMock} from "../../../test/mocks/user";
import {FacebookPixel} from "../../transport/plugins/facebook/facebookPixel";
import {GA4Pixel} from "../../transport/plugins/ga4_pixel/ga4Pixel";
import {OpenAIPixel} from "../../transport/plugins/openai/openaiPixel";
import {PinterestTag} from "../../transport/plugins/pinterest/pinterestTag";
import {RedditPixel} from "../../transport/plugins/reddit/redditPixel";
import {SnapchatPixel} from "../../transport/plugins/snapchat/snapchatPixel";
import {TikTokPixel} from "../../transport/plugins/tiktok/tiktokPixel";

describe("pixel plugin slugs", () => {
  function newLoader(): any {
    const loader = new Loader({
      setTag: jest.fn(),
      setResponse: jest.fn(),
      captureException: jest.fn(),
      captureMessage: jest.fn(),
    } as unknown as SentryWrapper) as any;
    loader.user = new UserMock(randomUUID(), randomUUID(), {}, {});
    loader.sdkSettings = {writeKey: "wk_123"};
    return loader;
  }

  function newSync(destinationApp: string): Sync {
    return {
      id: `sync-${destinationApp}`,
      destination_app: destinationApp,
      settings: [
        {key: "pixel_id", value: "pixel-123"},
        {key: "pixel_code", value: "pixel-123"},
        {key: "mesurement_id", value: "G-123"},
        {key: "tag_id", value: "tag-123"},
      ],
      field_mappings: [],
      event_mappings: [],
    };
  }

  it.each([
    ["facebook_pixel", FacebookPixel],
    ["ga4_pixel", GA4Pixel],
    ["openai_pixel", OpenAIPixel],
    ["pinterest_tag", PinterestTag],
    ["reddit_pixel", RedditPixel],
    ["snapchat_pixel", SnapchatPixel],
    ["tiktok_pixel", TikTokPixel],
  ])("loads %s for both the slug and its _legacy variant", (slug, pluginClass) => {
    const loader = newLoader();
    const sharedDeps = loader.createSharedPluginDependencies();

    expect(loader.createPlugin(newSync(slug), sharedDeps)).toBeInstanceOf(pluginClass);
    expect(loader.createPlugin(newSync(`${slug}_legacy`), sharedDeps)).toBeInstanceOf(pluginClass);
  });

  it("does not load a plugin for an unknown _legacy slug", () => {
    const loader = newLoader();
    const sharedDeps = loader.createSharedPluginDependencies();

    expect(loader.createPlugin(newSync("x_pixel_legacy"), sharedDeps)).toBeNull();
  });
});

describe("write key validation", () => {
  const suffix = "a1B2c3D4e5F6g7H8i9J0k1L2m3N";

  it.each([
    `wk_${suffix}`,
    `wk_test_${suffix}`,
  ])("accepts a valid write key: %s", (writeKey) => {
    expect(isValidWriteKey(writeKey)).toBe(true);
  });

  it.each([
    null,
    undefined,
    "",
    suffix,
    `wk_${suffix.slice(1)}`,
    `wk_${suffix}4`,
    `wk_${suffix.slice(0, -1)}_`,
    `wk_test_${suffix.slice(1)}`,
    `wk_test_${suffix}4`,
    `wk_test_${suffix.slice(0, -1)}-`,
  ])("rejects an invalid write key: %s", (writeKey) => {
    expect(isValidWriteKey(writeKey)).toBe(false);
  });
});

describe("Loader session handling", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should clear utm and jrnf campaign params from storage when the session expires", () => {
    localStorage.setItem("utm_campaign", "test");
    localStorage.setItem("jrnf_campaign_id", "120210987654321");

    const sessionDurationMin = 1;
    const loader = new Loader({} as unknown as SentryWrapper);
    (loader as unknown as { sdkSettings: SdkSettings }).sdkSettings = {
      writeKey: "wk_test",
      options: { sessionDurationMin },
    };
    loader.startNewSession();

    jest.advanceTimersByTime(sessionDurationMin * 60 * 1000);

    expect(localStorage.getItem("utm_campaign")).toBeNull();
    expect(localStorage.getItem("jrnf_campaign_id")).toBeNull();
  });
});
