import { BrowserMock } from "../../../test/mocks/browser";
import { Store } from "../../store/store";
import { ExternalIdsSessionCacheImpl } from "../externalId";

describe("External ID cache", () => {
  it("should store external IDs in the session storage", () => {
    const sessionStorageMock: Store = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    };
    const googleClickID = "google-click-id-873890I3";
    const linkedinClickID = "linkedin-click-id-1830389";
    const googleWbraid = "google-wbraid-873890I3";
    const googleGbraid = "google-gbraid-KJGJKfdsjf";
    const snapClickID = "snapchat-click-id-873890I3";
    const tiktokClickID = "tiktok-click-id-KJGJKfdsjf";
    const twitterClickID = "twitter-click-id-UH3JKH3KJH";
    const pinterestClickID = "pinterest-click-id-8jfskldfjk";
    const locationMock = { ...document.location };
    locationMock.search = `?ScCid=${snapClickID}&ttclid=${tiktokClickID}&twclid=${twitterClickID}&epik=${pinterestClickID}&wbraid=${googleWbraid}&gbraid=${googleGbraid}&gclid=${googleClickID}&li_fat_id=${linkedinClickID}`;
    const browser = new BrowserMock();
    browser.setLocation(locationMock);

    const cache = new ExternalIdsSessionCacheImpl(browser, sessionStorageMock);
    expect(cache).toBeDefined();
    expect(sessionStorageMock.set).toHaveBeenCalledTimes(1);
    expect(sessionStorageMock.set).toHaveBeenCalledWith(
      "journifyio_external_ids",
      {
        snapchat_click_id: snapClickID,
        tiktok_click_id: tiktokClickID,
        twitter_click_id: twitterClickID,
        pinterest_click_id: pinterestClickID,
        google_click_id: googleClickID,
        google_wbraid: googleWbraid,
        google_gbraid: googleGbraid,
        linkedin_click_id: linkedinClickID,
      }
    );
  });

  it("should fetch external IDs from the session storage", () => {
    const sessionStoreContent = {};
    const sessionStorageMock: Store = {
      get: jest.fn((key) => sessionStoreContent[key]),
      set: jest.fn((key, value) => {
        sessionStoreContent[key] = value;
        return value;
      }),
      remove: jest.fn((key) => {
        delete sessionStoreContent[key];
      }),
    };
    const googleWbraid = "google-wbraid-873890I3";
    const googleGbraid = "google-gbraid-KJGJKfdsjf";
    const snapClickID = "snapchat-click-id-873890I3";
    const linkedinClickID = "linkedin-click-id-093878903";
    const tiktokClickID = "tiktok-click-id-KJGJKfdsjf";
    const googleClickID = "google-click-id-UH3JKH3KJH";
    const pinterestClickID = "pinterest-click-id-8jfskldfjlsdkjflkdsj";
    const locationMock = { ...document.location };
    locationMock.search = `?gclid=${googleClickID}&ttclid=${tiktokClickID}&ScCid=${snapClickID}&epik=${pinterestClickID}&wbraid=${googleWbraid}&gbraid=${googleGbraid}&li_fat_id=${linkedinClickID}`;
    const browser = new BrowserMock();
    browser.setLocation(locationMock);

    const firstPageCache = new ExternalIdsSessionCacheImpl(
      browser,
      sessionStorageMock
    );
    expect(firstPageCache).toBeDefined();
    const firstExternalIds = firstPageCache.getExternalIds();
    expect(firstExternalIds).toEqual({
      snapchat_click_id: snapClickID,
      tiktok_click_id: tiktokClickID,
      google_click_id: googleClickID,
      pinterest_click_id: pinterestClickID,
      google_wbraid: googleWbraid,
      google_gbraid: googleGbraid,
      linkedin_click_id: linkedinClickID,
    });

    // simulate page redirect
    const secondPageCache = new ExternalIdsSessionCacheImpl(
      browser,
      sessionStorageMock
    );
    expect(secondPageCache).toBeDefined();
    const twitterClickID = "twitter-click-id-UH3JKH3KJH";
    const newSnapClickID = "snapchat-click-id-8jfskldfjklsd838";
    const newLinkedinClickID = "linkedin-click-id-KJHJKL567389";
    const secondLocationMock = { ...document.location };

    secondLocationMock.search = `?twclid=${twitterClickID}&ScCid=${newSnapClickID}&li_fat_id=${newLinkedinClickID}`;
    browser.setLocation(secondLocationMock);

    const secondExternalIds = secondPageCache.getExternalIds();
    expect(secondExternalIds).toEqual({
      snapchat_click_id: newSnapClickID,
      tiktok_click_id: tiktokClickID,
      google_click_id: googleClickID,
      twitter_click_id: twitterClickID,
      pinterest_click_id: pinterestClickID,
      google_wbraid: googleWbraid,
      google_gbraid: googleGbraid,
      linkedin_click_id: newLinkedinClickID,
    });
  });
});
