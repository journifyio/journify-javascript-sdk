import JsCookie from "js-cookie";
import { load } from "../index";

const mockLoaderLoad = jest.fn().mockResolvedValue({});

jest.mock("../api/loader", () => ({
  getProductionWriteKey: (writeKey: string) => writeKey,
  Loader: jest.fn().mockImplementation(() => ({
    load: (...args: unknown[]) => mockLoaderLoad(...args),
  })),
}));

describe("write key settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    JsCookie.remove("k1");
    JsCookie.remove("k2");
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
      "https://cdn.example.com/write_keys/wk_example.json"
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
      "https://api.example.com/v1/px/wk_example.json"
    );
  });

  it("sets x-jrnf values as cookies without overwriting existing values", async () => {
    JsCookie.set("k2", "existing");
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({
        "x-jrnf": "k1=v1;k2=v2;",
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

    expect(JsCookie.get("k1")).toBe("v1");
    expect(JsCookie.get("k2")).toBe("existing");
  });
});
