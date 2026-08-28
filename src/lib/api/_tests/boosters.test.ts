import { applyBoosters } from "../boosters";
import { Booster, SdkOptions } from "../../transport/plugins/plugin";

const HASHING_ON_PII_ON: SdkOptions = {
  enableHashing: true,
  autoCapturePII: true,
};

const HASHING_OFF_PII_ON: SdkOptions = {
  enableHashing: false,
  autoCapturePII: true,
};

const HASHING_ON_PII_OFF: SdkOptions = {
  enableHashing: true,
  autoCapturePII: false,
};

describe("applyBoosters", () => {
  it("preserves local flags when boosters is omitted or invalid", () => {
    expect(applyBoosters(HASHING_ON_PII_ON)).toEqual(HASHING_ON_PII_ON);
    expect(applyBoosters(HASHING_ON_PII_ON, undefined)).toEqual(
      HASHING_ON_PII_ON
    );
    expect(applyBoosters(HASHING_ON_PII_ON, null as unknown as Booster[])).toEqual(
      HASHING_ON_PII_ON
    );
    expect(
      applyBoosters(HASHING_ON_PII_ON, { name: "end2end_hashing" } as unknown as Booster[])
    ).toEqual(HASHING_ON_PII_ON);
  });

  it("preserves local flags when boosters is an empty array", () => {
    expect(applyBoosters(HASHING_ON_PII_ON, [])).toEqual(HASHING_ON_PII_ON);
  });

  it("enables hashing when end2end_hashing is listed", () => {
    expect(
      applyBoosters(HASHING_OFF_PII_ON, [{ name: "end2end_hashing" }])
    ).toEqual({
      enableHashing: true,
      autoCapturePII: true,
    });
  });

  it("enables auto-capture PII when auto_capture_pii is listed", () => {
    expect(
      applyBoosters(HASHING_ON_PII_OFF, [{ name: "auto_capture_pii" }])
    ).toEqual({
      enableHashing: true,
      autoCapturePII: true,
    });
  });

  it("enables both flags when both named boosters are listed", () => {
    const boosters: Booster[] = [
      { name: "end2end_hashing" },
      { name: "auto_capture_pii" },
    ];

    expect(applyBoosters(HASHING_OFF_PII_ON, boosters)).toEqual({
      enableHashing: true,
      autoCapturePII: true,
    });
  });

  it("ignores unknown booster names including cookie_keeper", () => {
    const boosters: Booster[] = [
      { name: "cookie_keeper" },
      { name: "not_a_real_booster" },
    ];

    expect(applyBoosters(HASHING_ON_PII_ON, boosters)).toEqual(
      HASHING_ON_PII_ON
    );
  });
});
