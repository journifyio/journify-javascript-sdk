import { CookiesStore } from "../store/cookiesStore";
import { load } from "../index";

const mockLoaderLoad = jest.fn().mockResolvedValue({});
const cookiesStore = new CookiesStore();

jest.mock("../api/loader", () => ({
  getProductionWriteKey: (writeKey: string) => writeKey,
  Loader: jest.fn().mockImplementation(() => ({
    load: (...args: unknown[]) => mockLoaderLoad(...args),
  })),
}));

describe("write key settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookiesStore.remove("_ga");
    cookiesStore.remove("_fbp");
  });

  it("loads settings from the CDN by default", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      json: jest.fn().mockResolvedValue({ syncs: [] }),
    });

    await load({
      writeKey: "wk_example",
      cdnHost: "https://cdn.example.com",
      apiHost: "https://api.example.com",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://cdn.example.com/write_keys/wk_example.json",
      {
        credentials: "include",
      }
    );
  });

  it("loads settings from the API when cookie keeper is enabled", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      json: jest.fn().mockResolvedValue({ syncs: [] }),
    });

    await load({
      writeKey: "wk_example",
      cdnHost: "https://cdn.example.com",
      apiHost: "https://api.example.com",
      options: {
        enableCookieKeeper: true,
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/px/wk_example.json",
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
        "x-jrnf-eids":
          "%7B%22_ga%22%3A%22click_123%22%2C%22_fbp%22%3A%22fb.1.123%22%7D",
      }),
      json: jest.fn().mockResolvedValue({ syncs: [] }),
    });

    await load({
      writeKey: "wk_example",
      apiHost: "https://api.example.com",
      options: {
        enableCookieKeeper: true,
      },
    });

    expect(cookiesStore.get("_ga")).toBe("click_123");
    expect(cookiesStore.get("_fbp")).toBe("existing");
  });
});
