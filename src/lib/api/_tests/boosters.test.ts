import { applyBoosters } from "../boosters";
import { Booster, SdkSettings } from "../../transport/plugins/plugin";

type LocalSdkOptions = NonNullable<SdkSettings["options"]>;

const HASHING_ON_PII_ON: LocalSdkOptions = {
  enableHashing: true,
  autoCapturePII: true,
};

const HASHING_OFF_PII_OFF: LocalSdkOptions = {
  enableHashing: false,
  autoCapturePII: false,
};

describe("applyBoosters", () => {
  it("preserves local flags when boosters is omitted", () => {
    expect(applyBoosters(HASHING_ON_PII_ON)).toEqual(HASHING_ON_PII_ON);
    expect(applyBoosters(HASHING_ON_PII_ON, undefined)).toEqual(
      HASHING_ON_PII_ON
    );
  });

  it("disables both flags when boosters is an empty array, overriding local true", () => {
    expect(applyBoosters(HASHING_ON_PII_ON, [])).toEqual({
      enableHashing: false,
      autoCapturePII: false,
    });
  });

  it("enables only hashing when end2end_hashing is listed, overriding local auto-capture", () => {
    const boosters: Booster[] = [{ name: "end2end_hashing" }];

    expect(applyBoosters(HASHING_ON_PII_ON, boosters)).toEqual({
      enableHashing: true,
      autoCapturePII: false,
    });
  });

  it("enables both flags when both named boosters are listed, overriding local false", () => {
    const boosters: Booster[] = [
      { name: "end2end_hashing" },
      { name: "auto_capture_pii" },
    ];

    expect(applyBoosters(HASHING_OFF_PII_OFF, boosters)).toEqual({
      enableHashing: true,
      autoCapturePII: true,
    });
  });

  it("ignores unknown booster names including cookie_keeper", () => {
    const boosters: Booster[] = [
      { name: "cookie_keeper" },
      { name: "not_a_real_booster" },
    ];

    expect(applyBoosters(HASHING_ON_PII_ON, boosters)).toEqual({
      enableHashing: false,
      autoCapturePII: false,
    });
  });

  it("treats null or non-array boosters as missing and preserves local flags", () => {
    expect(applyBoosters(HASHING_ON_PII_ON, null as unknown as Booster[])).toEqual(
      HASHING_ON_PII_ON
    );
    expect(
      applyBoosters(HASHING_ON_PII_ON, { name: "end2end_hashing" } as unknown as Booster[])
    ).toEqual(HASHING_ON_PII_ON);
  });

  it("enables hashing when the booster includes extra options", () => {
    const boosters: Booster[] = [
      { name: "end2end_hashing", options: { algorithm: "sha256" } },
    ];

    expect(applyBoosters(HASHING_OFF_PII_OFF, boosters)).toEqual({
      enableHashing: true,
      autoCapturePII: false,
    });
  });

  it("does not mutate the local options object", () => {
    const local: LocalSdkOptions = { ...HASHING_ON_PII_ON };
    applyBoosters(local, []);
    expect(local).toEqual(HASHING_ON_PII_ON);
  });

  it("preserves unrelated local options when dashboard owns the two flags", () => {
    const local: LocalSdkOptions = {
      enableHashing: true,
      autoCapturePII: false,
      additionalPIIKeys: ["loyalty_id"],
      autoCapturePhoneRegex: "custom",
      sessionDurationMin: 15,
    };

    expect(applyBoosters(local, [{ name: "auto_capture_pii" }])).toEqual({
      enableHashing: false,
      autoCapturePII: true,
      additionalPIIKeys: ["loyalty_id"],
      autoCapturePhoneRegex: "custom",
      sessionDurationMin: 15,
    });
  });

  it("skips booster entries without a name", () => {
    const boosters: Booster[] = [
      { name: "" },
      {} as Booster,
      { name: "end2end_hashing" },
    ];

    expect(applyBoosters(HASHING_OFF_PII_OFF, boosters)).toEqual({
      enableHashing: true,
      autoCapturePII: false,
    });
  });
});
