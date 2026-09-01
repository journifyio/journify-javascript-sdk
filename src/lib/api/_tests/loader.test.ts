import {isValidWriteKey, Loader} from "../loader";
import {SentryWrapper} from "../../lib/sentry";
import {SdkSettings} from "../../transport/plugins/plugin";

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
