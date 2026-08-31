import { Booster, SdkOptions } from "../transport/plugins/plugin";

export const END2END_HASHING_BOOSTER = "end2end_hashing";
export const AUTO_CAPTURE_PII_BOOSTER = "auto_capture_pii";

/**
 * Merge dashboard boosters onto local SDK options.
 *
 * Remote boosters are enable-only signals for `enableHashing` and
 * `autoCapturePII`. Missing, malformed, empty, or unknown boosters leave
 * local options unchanged so existing snippets keep working.
 */
export function applyBoosters(
  local?: SdkOptions,
  boosters?: Booster[]
): SdkOptions {
  // Clone so the caller's options object is never mutated.
  const options: SdkOptions = { ...(local || {}) };

  if (!Array.isArray(boosters)) {
    return options;
  }

  const enabledNames = new Set<string>();
  for (const booster of boosters) {
    if (booster?.name) {
      enabledNames.add(booster.name);
    }
  }

  if (enabledNames.has(END2END_HASHING_BOOSTER)) {
    options.enableHashing = true;
  }
  if (enabledNames.has(AUTO_CAPTURE_PII_BOOSTER)) {
    options.autoCapturePII = true;
  }

  return options;
}
