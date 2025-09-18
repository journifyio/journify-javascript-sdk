import { SyncSetting } from "../../plugin";
import { toSettingsObject } from "../settings";

describe("toSettingsObject", () => {
  it("should turn a settings array into an object", () => {
    const settings: SyncSetting[] = [
      { key: "account_id", value: "12345" },
      { key: "region", value: "us1" },
    ];

    const result = toSettingsObject(settings);
    expect(result).toEqual({
      account_id: "12345",
      region: "us1",
    });
  });

  it("should return an empty object if the input is null or undefined", () => {
    const resultNull = toSettingsObject(null);
    expect(resultNull).toEqual({});
    const resultUndefined = toSettingsObject(undefined);
    expect(resultUndefined).toEqual({});
  });

  it("should return an empty object if the input is an empty array", () => {
    const result = toSettingsObject([]);
    expect(result).toEqual({});
  });
});
