import { BrowserImpl } from "../browser";
import { createStoresForTest } from "../../../test/helpers/stores";
import { StoresGroup } from "../../store/store";

describe("BrowserImpl", () => {
  let browser: BrowserImpl;

  beforeEach(() => {
    browser = new BrowserImpl();
  });
  describe("scriptAlreadyInPage", () => {
    it("should return true if the script is already in the page", () => {
      const scriptUrl = "https://example.com/script.js";
      document.body.innerHTML =
        '<html> <head><script src="https://example.com/script.js"></script></head><body>Hello world</body> </html>';
      const result = browser.scriptAlreadyInPage(scriptUrl);
      expect(result).toBe(true);
    });

    it("should return false if the script is not in the page", () => {
      const scriptUrl = "https://example.com/script.js";
      document.body.innerHTML =
        '<html><head><script src="https://example.com/script-2.js"></script></head><body>Hello world</body></html>';
      const result = browser.scriptAlreadyInPage(scriptUrl);
      expect(result).toBe(false);
    });
  });

  describe("utmCampaign", () => {
    it("should return undefined if no utm campaign parameters are found", () => {
      const queryString = "";
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );

      const result = browser.utmCampaign(queryString, stores);

      expect(result).toBeUndefined();
    });

    it("should return the utm campaign parameters if they are found", () => {
      const queryString = "utm_campaign=test&utm_source=source";
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );

      const result = browser.utmCampaign(queryString, stores);

      expect(result).toEqual({
        name: "test",
        source: "source",
      });
    });

    it("should prioritize utm campaign parameters from the query string over the stores", () => {
      const queryString = "utm_campaign=test&utm_source=source";
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      stores.set("utm_campaign", "wrong");
      stores.set("utm_source", "wrong");

      const result = browser.utmCampaign(queryString, stores);

      expect(result).toEqual({
        name: "test",
        source: "source",
      });
    });

    it("should return utm compaign values as strings", () => {
      const queryString = "";
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      stores.set("utm_campaign", 1212);
      stores.set("utm_source", 12122);

      const result = browser.utmCampaign(queryString, stores);

      expect(result).toEqual({
        name: "1212",
        source: "12122",
      });
    });

    it("should store the utm campaign parameters in the stores", () => {
      const queryString = "utm_campaign=test&utm_source=source";
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );

      browser.utmCampaign(queryString, stores);

      expect(stores.get("utm_campaign")).toEqual("test");
      expect(stores.get("utm_source")).toEqual("source");
    });

    it("should return the jrnf campaign parameters if they are found", () => {
      const queryString =
        "jrnf_source_id=meta&jrnf_campaign_id=120210987654321&jrnf_ad_group_id=120210987654322&jrnf_ad_id=120210987654323&jrnf_creative_id=238512345678901&jrnf_placement=instagram_stories";
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );

      const result = browser.utmCampaign(queryString, stores);

      expect(result).toEqual({
        sourceId: "meta",
        campaignId: "120210987654321",
        adGroupId: "120210987654322",
        adId: "120210987654323",
        creativeId: "238512345678901",
        placement: "instagram_stories",
      });
    });

    it("should return both utm and jrnf campaign parameters when both are present", () => {
      const queryString =
        "utm_source=google&utm_medium=cpc&jrnf_campaign_id=120210987654321&jrnf_ad_id=120210987654323";
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );

      const result = browser.utmCampaign(queryString, stores);

      expect(result).toEqual({
        source: "google",
        medium: "cpc",
        campaignId: "120210987654321",
        adId: "120210987654323",
      });
    });

    it("should store the jrnf campaign parameters in the stores", () => {
      const queryString = "jrnf_campaign_id=120210987654321";
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );

      browser.utmCampaign(queryString, stores);

      expect(stores.get("jrnf_campaign_id")).toEqual("120210987654321");
    });
  });
});
