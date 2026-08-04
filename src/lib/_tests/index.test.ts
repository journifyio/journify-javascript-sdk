import * as Journify from "../index";
import { CookiesStore } from "../store/cookiesStore";
import { Loader } from "../api/loader";
import { Sdk } from "../api/sdk";

const mockLoaderLoad = jest.fn().mockResolvedValue({});
const cookiesStore = new CookiesStore();

jest.mock("../api/loader", () => ({
  getProductionWriteKey: (writeKey: string) => writeKey,
  isValidWriteKey: (writeKey: string) =>
    /^(?:wk_|wk_test_)[a-zA-Z0-9]{27}$/.test(writeKey),
  Loader: class {
    load(...args: unknown[]) {
      return mockLoaderLoad(...args);
    }
  },
}));

describe("write key settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ["_fbc", "_fbp", "_gcl_aw", "facebook_click_id"].forEach((cookie) =>
      cookiesStore.remove(cookie)
    );
  });

  it("loads settings from the CDN by default", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      json: jest.fn().mockResolvedValue({ syncs: [] }),
    });

    await Journify.load({
      writeKey: "wk_3HRNlvW2C30FEcfkcCwyRqYJF1w",
      cdnHost: "https://cdn.example.com",
      apiHost: "https://api.example.com",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://cdn.example.com/write_keys/wk_3HRNlvW2C30FEcfkcCwyRqYJF1w.json",
      {}
    );
  });

  it("loads settings from the API when cookie keeper is enabled", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      json: jest.fn().mockResolvedValue({ syncs: [] }),
    });

    await Journify.load({
      writeKey: "wk_3HRNlvW2C30FEcfkcCwyRqYJF1w",
      cdnHost: "https://cdn.example.com",
      apiHost: "https://api.example.com",
      options: {
        enableCookieKeeper: true,
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/px/wk_3HRNlvW2C30FEcfkcCwyRqYJF1w.json",
      {
        credentials: "include",
      }
    );
  });

  it("sets x-jrnf-eids values as cookies without overwriting existing values", async () => {
    cookiesStore.set("_fbp", "existing");
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({
        "x-jrnf-eids": encodeURIComponent(
          JSON.stringify({
            facebook_click_id: "facebook-click-id",
            facebook_browser_id: "facebook-browser-id",
            google_click_id: "google-click-id",
          })
        ),
      }),
      json: jest.fn().mockResolvedValue({ syncs: [] }),
    });

    await Journify.load({
      writeKey: "wk_3HRNlvW2C30FEcfkcCwyRqYJF1w",
      apiHost: "https://api.example.com",
      options: {
        enableCookieKeeper: true,
      },
    });

    expect(cookiesStore.get("_fbc")).toBe("facebook-click-id");
    expect(cookiesStore.get("_fbp")).toBe("existing");
    expect(cookiesStore.get("_gcl_aw")).toBe("google-click-id");
    expect(cookiesStore.get("facebook_click_id")).toBeNull();
  });
});

describe("SDK write key validation", () => {
  const validWriteKey = "wk_test_3HRNlvW2C30FEcfkcCwyRqYJF1w";
  const sdk = {
    track: jest.fn(),
  };

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation();
    jest
      .spyOn(Loader.prototype, "load")
      .mockResolvedValue(sdk as unknown as Sdk);
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: {
        get: jest.fn(),
      },
      json: jest.fn().mockResolvedValue({
        syncs: [],
      }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sdk.track.mockReset();
  });

  it("does not initialize the SDK or send events with an invalid write key", async () => {
    await Journify.load({
      writeKey: "invalid",
    });
    await Journify.track("Test Event");
    await Journify.track("Another Test Event");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(Loader.prototype.load).not.toHaveBeenCalled();
    expect(sdk.track).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenLastCalledWith(
      "[Journify] Invalid write key. Event was not sent."
    );
  });

  it("stops sending events when reinitialized with an invalid write key", async () => {
    await Journify.load({
      writeKey: validWriteKey,
    });
    await Journify.track("First Event");

    await Journify.load({
      writeKey: "invalid",
    });
    await Journify.track("Second Event");

    expect(sdk.track).toHaveBeenCalledTimes(1);
    expect(sdk.track).toHaveBeenCalledWith("First Event", undefined, {});
  });
});
