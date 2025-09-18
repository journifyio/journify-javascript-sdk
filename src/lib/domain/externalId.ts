import { JSONValue } from "./traits";
import { Browser } from "../transport/browser";
import { Store } from "../store/store";

export type ExternalIds = object & {
  [k: string]: JSONValue;
};

export interface ExternalIdsSessionCache {
  getExternalIds(): ExternalIds;
}

export class ExternalIdsSessionCacheImpl implements ExternalIdsSessionCache {
  private browser: Browser;
  private sessionStorage: Store;
  constructor(browser: Browser, sessionStorage: Store) {
    this.sessionStorage = sessionStorage;
    this.browser = browser;
    this.initIds();
  }

  getExternalIds(): ExternalIds {
    const urlParams = new URLSearchParams(this.browser.location().search);
    const potentialIds = {
      snapchat_click_id: urlParams.get("ScCid"),
      tiktok_click_id: urlParams.get("ttclid"),
      twitter_click_id: urlParams.get("twclid"),
      google_click_id: urlParams.get("gclid"),
      google_wbraid: urlParams.get("wbraid"),
      google_gbraid: urlParams.get("gbraid"),
      pinterest_click_id: urlParams.get("epik"),
      microsoft_click_id: urlParams.get("msclkid"),
      linkedin_click_id: urlParams.get("li_fat_id"),
    };
    const currentIds = Object.entries(potentialIds).reduce(
      (accumulator, [key, value]) => {
        if (value) {
          accumulator[key] = value;
        }

        return accumulator;
      },
      {}
    );

    const storedIds: ExternalIds =
      this.sessionStorage.get(EXTERNAL_IDS_SESSION_STORAGE_KEY) || {};
    return {
      ...storedIds,
      ...currentIds,
    };
  }

  private initIds() {
    const ids = this.getExternalIds();
    this.sessionStorage.set(EXTERNAL_IDS_SESSION_STORAGE_KEY, ids);
  }
}

const EXTERNAL_IDS_SESSION_STORAGE_KEY = "journifyio_external_ids";
