import * as Journify from "../index";
import {Loader} from "../api/loader";
import {Sdk} from "../api/sdk";

describe("SDK write key validation", () => {
  const validWriteKey = `wk_${"a".repeat(27)}`;
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

    expect(global.fetch).not.toHaveBeenCalled();
    expect(Loader.prototype.load).not.toHaveBeenCalled();
    expect(sdk.track).not.toHaveBeenCalled();
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
