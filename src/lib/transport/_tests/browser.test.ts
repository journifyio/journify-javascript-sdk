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
  });
});
