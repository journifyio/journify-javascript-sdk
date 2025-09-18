/* eslint-disable  @typescript-eslint/no-explicit-any */
import { SyncSetting } from "../plugin";

export function toSettingsObject(settings: SyncSetting[]): Record<string, any> {
  if (!settings) {
    return {};
  }

  return settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
}
