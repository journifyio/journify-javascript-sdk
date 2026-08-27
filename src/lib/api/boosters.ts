import { Booster, SdkSettings } from "../transport/plugins/plugin";

export const END2END_HASHING_BOOSTER = "end2end_hashing";
export const AUTO_CAPTURE_PII_BOOSTER = "auto_capture_pii";

type LocalSdkOptions = NonNullable<SdkSettings["options"]>;

/**
 * Merge dashboard boosters onto local (legacy) SDK options.
 *
 * Precedence:
 * 1. Dashboard `boosters` array (source of truth when present)
 * 2. Local options passed to `load()` (legacy)
 * 3. Hardcoded safe defaults (feature off)
 *
 * When `boosters` is missing or not an array (old JSON, fetch fallback,
 * malformed payload), local options are returned unchanged so existing
 * snippets keep working. When it is an array — including `[]` — the
 * dashboard owns `enableHashing` and `autoCapturePII`: a named booster
 * enables the flag, absence disables it, even if local was `true`.
 *
 * Unknown booster names (e.g. `cookie_keeper`) and extra `options`
 * (e.g. `{ algorithm: "sha256" }`) are ignored.
 */
export function applyBoosters(
  local?: SdkSettings["options"],
  boosters?: Booster[]
): LocalSdkOptions {
  // Clone so the caller's options object is never mutated.
  const options: LocalSdkOptions = { ...(local || {}) };

  // No remote boosters field → legacy local config, then safe defaults.
  if (!Array.isArray(boosters)) {
    return options;
  }

  const enabledNames = new Set<string>();
  for (const booster of boosters) {
    if (booster?.name) {
      enabledNames.add(booster.name);
    }
  }

  // Dashboard owns these two flags whenever `boosters` is an array.
  options.enableHashing = enabledNames.has(END2END_HASHING_BOOSTER);
  options.autoCapturePII = enabledNames.has(AUTO_CAPTURE_PII_BOOSTER);

  return options;
}
