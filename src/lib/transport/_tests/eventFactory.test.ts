import * as uuid from "uuid";
import {EventFactoryImpl} from "../eventFactory";
import {UserMock} from "../../../test/mocks/user";
import {User, UserImpl} from "../../domain/user";
import {Traits} from "../../domain/traits";
import {JournifyEvent, JournifyEventType, UtmCampaign,} from "../../domain/event";
import {LIB_VERSION} from "../../generated/libVersion";
import {SESSION_ID_PERSISTENCE_KEY, StoresGroup} from "../../store/store";
import * as cookiesStoreModule from "../../store/cookiesStore";
import {createStoresForTest} from "../../../test/helpers/stores";
import {BrowserMock} from "../../../test/mocks/browser";
import {ExternalIds, ExternalIdsSessionCacheImpl,} from "../../domain/externalId";
import {SessionStore} from "../../store/sessionStore";

import {TextDecoder, TextEncoder} from "util";
import {ConsentServiceMock} from "../../../test/mocks/consentService";
import {ConsentPreference} from "../../domain/consent";

Object.assign(global, { TextDecoder, TextEncoder });

describe("EventFactoryImpl class", () => {
  describe("newTrackEvent, newPageEvent, and newIdentifyEvent methods", () => {
    it("Should create an identify event and add context enrichment automatically", async function () {
      const userAgent =
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36";
      const locale = "Fr-Fr";
      const browser = new BrowserMock();
      browser.setOnline(true);

      const canonicalUrl = "http://www.journify.io";
      browser.setCanonicalUrl(canonicalUrl);

      const pathname = "/blog/tech";
      browser.setCanonicalPath(pathname);

      const navigator: Navigator = {
        ...global.navigator,
        userAgent: userAgent,
        language: locale,
      };
      browser.setNavigator(navigator);

      const referrer = "https://www.google.com/";
      const title = "Page title example";
      const document: Document = {
        ...global.document,
        referrer,
        title,
      };
      browser.setDocument(document);

      const openaiUrlOppref = "openai-oppref-from-url-7f3a";
      const sq =
        `?ttclid=tiktok-click-id-93893&ScCid=snap-click-id-87388&oppref=${openaiUrlOppref}&utm_source=campaign-source-123&utm_medium=campaign-medium-123&utm_campaign=campaign-name-123&utm_id=campaign-id-123&utm_term=campaign-term-123&utm_content=campaign-content-123`;
      const location: Location = {
        ...global.location,
        search: sq,
      };
      browser.setLocation(location);

      const windowMock = { ...window };
      browser.setWindow(windowMock);

      const campaign: UtmCampaign = {
        id: "campaign-id-123",
        name: "campaign-name-123",
        source: "campaign-source-123",
        medium: "campaign-medium-123",
        term: "campaign-term-123",
        content: "campaign-content-123",
      };
      browser.setCampaign(campaign);

      const initialUserId = "initial-user-id-example";
      const initialAnonymousId = uuid.v4();
      const initialTraits: Traits = {
        email: "example@mail.com",
        location: "Morocco",
      };
      const initialExternalIds: ExternalIds = {
        username: "joe-doe",
      };

      const user: User = new UserMock(
        initialUserId,
        initialAnonymousId,
        initialTraits,
        initialExternalIds,
        {}
      );

      const externalIdsCache = new ExternalIdsSessionCacheImpl(
        browser,
        new SessionStore(browser)
      );

      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );

      // The OpenAI pixel persists oppref to a first-party __oppref cookie. A fresh
      // oppref URL param (above) should take precedence over this stored cookie value.
      testStores.cookies.set("__oppref", "openai-oppref-from-cookie-stale");

      const consentService = new ConsentServiceMock();

      const eventFactory = new EventFactoryImpl(
        stores,
        testStores.cookies,
        browser,
        externalIdsCache,
        consentService
      );
      eventFactory.setUser(user);

      const actualEvent = await eventFactory.newIdentifyEvent();
      const expectedEvent: JournifyEvent = {
        type: JournifyEventType.IDENTIFY,
        userId: initialUserId,
        anonymousId: initialAnonymousId,
        traits: initialTraits,
        externalIds: {
          username: "joe-doe",
          snapchat_click_id: "snap-click-id-87388",
          tiktok_click_id: "tiktok-click-id-93893",
          openai_click_id: openaiUrlOppref,
          snapchat_advertiser_cookie_1: initialAnonymousId,
        },
        context: {
          userAgent,
          locale,
          groupId: null,
          library: {
            name: "@journifyio/js-sdk",
            version: LIB_VERSION,
          },
          page: {
            url: canonicalUrl,
            path: pathname,
            search: sq,
            referrer,
            title,
          },
          campaign: campaign,
          consent: {
            categoryPreferences: {
              advertising: ConsentPreference.UNSPECIFIED,
              analytics: ConsentPreference.UNSPECIFIED,
              marketing: ConsentPreference.UNSPECIFIED,
              personalization: ConsentPreference.UNSPECIFIED,
              functional: ConsentPreference.UNSPECIFIED,
            },
          },
        },
      };

      const dynamicKeys = ["timestamp", "messageId"];
      const expectedKeysLength =
        Object.keys(expectedEvent).length + dynamicKeys.length;
      expect(Object.keys(actualEvent)).toHaveLength(expectedKeysLength);

      for (const key in actualEvent) {
        if (dynamicKeys.includes(key)) {
          expect(actualEvent[key]).toBeDefined();
          expect(actualEvent[key]).not.toBeNull();
        } else {
          expect(actualEvent[key]).toEqual(expectedEvent[key]);
        }
      }
    });

    it("Should create a track event", async function () {
      const browser = new BrowserMock();
      browser.setOnline(true);
      browser.setNavigator({ ...global.navigator });
      browser.setDocument({ ...global.document });
      browser.setLocation({ ...global.location });
      browser.setWindow({ ...window });

      const externalIdsCache = new ExternalIdsSessionCacheImpl(
        browser,
        new SessionStore(browser)
      );

      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const user = new UserImpl(stores, sentryMock);
      const consentService = new ConsentServiceMock();

      const eventFactory = new EventFactoryImpl(
        stores,
        testStores.cookies,
        browser,
        externalIdsCache,
        consentService
      );
      eventFactory.setUser(user);

      const actualEvent = await eventFactory.newTrackEvent(
        "add_to_cart",
        {
          price: 100,
          currency: "USD",
          product_id: "product-id-123",
          hashed_email:
            "d709f370e52b57b4eb75f04e2b3422c4d41a05148cad8f81776d94a048fb70af",
          phone: "+2126987267893",
        },
        {
          userId: "user-id-example-track",
          city: "65c999721364379b3e5a6f4a659ffdb25207af573bde6a934cd949b31f1bcf96",
          country: "Morocco",
        }
      );
      expect(actualEvent.type).toEqual(JournifyEventType.TRACK);
      expect(actualEvent.event).toEqual("add_to_cart");
      expect(actualEvent.userId).toEqual("user-id-example-track");
      expect(actualEvent.properties).toEqual({
        price: 100,
        currency: "USD",
        product_id: "product-id-123",
        hashed_email:
          "d709f370e52b57b4eb75f04e2b3422c4d41a05148cad8f81776d94a048fb70af",
        phone: "+2126987267893",
      });

      expect(actualEvent.traits).toEqual({
        userId: "user-id-example-track",
        hashed_email:
          "d709f370e52b57b4eb75f04e2b3422c4d41a05148cad8f81776d94a048fb70af",
        phone: "+2126987267893",
        city: "65c999721364379b3e5a6f4a659ffdb25207af573bde6a934cd949b31f1bcf96",
        country: "Morocco",
      });
    });

    it("Should create a page event", async function () {
      const browser = new BrowserMock();
      browser.setOnline(true);
      browser.setNavigator({ ...global.navigator });
      browser.setDocument({ ...global.document });
      browser.setLocation({ ...global.location });
      browser.setWindow({ ...window });

      const externalIdsCache = new ExternalIdsSessionCacheImpl(
        browser,
        new SessionStore(browser)
      );

      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );

      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const user = new UserImpl(stores, sentryMock);
      const consentService = new ConsentServiceMock();

      const eventFactory = new EventFactoryImpl(
        stores,
        testStores.cookies,
        browser,
        externalIdsCache,
        consentService
      );
      eventFactory.setUser(user);

      const actualEvent = await eventFactory.newPageEvent(
        "Home",
        {
          path: "/",
          referrer: "https://www.google.com/",
          hashed_phone:
            "afee1504ead390e0284d70240a2fa7b883ca96d74e7a7ea3bb38519995fda3d6",
          email: "said@farid.co.uk",
        },
        {
          userId: "user-id-example-page",
          country: "United states",
          state: "California",
        }
      );
      expect(actualEvent.type).toEqual(JournifyEventType.PAGE);
      expect(actualEvent.userId).toEqual("user-id-example-page");
      expect(actualEvent.properties).toEqual({
        path: "/",
        referrer: "https://www.google.com/",
        email: "said@farid.co.uk",
        hashed_phone:
          "afee1504ead390e0284d70240a2fa7b883ca96d74e7a7ea3bb38519995fda3d6",
      });

      expect(actualEvent.traits).toEqual({
        userId: "user-id-example-page",
        email: "said@farid.co.uk",
        hashed_phone:
          "afee1504ead390e0284d70240a2fa7b883ca96d74e7a7ea3bb38519995fda3d6",
        country: "United states",
        state: "California",
      });
    });

    it("Should create a page event with userId from traits id field", async function () {
      const browser = new BrowserMock();
      browser.setOnline(true);
      browser.setNavigator({ ...global.navigator });
      browser.setDocument({ ...global.document });
      browser.setLocation({ ...global.location });
      browser.setWindow({ ...window });

      const externalIdsCache = new ExternalIdsSessionCacheImpl(
        browser,
        new SessionStore(browser)
      );

      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );

      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const user = new UserImpl(stores, sentryMock);
      const consentService = new ConsentServiceMock();

      const eventFactory = new EventFactoryImpl(
        stores,
        testStores.cookies,
        browser,
        externalIdsCache,
        consentService
      );
      eventFactory.setUser(user);

      const actualEvent = await eventFactory.newPageEvent(
        "Product Details",
        {
          path: "/products/123",
          category: "Electronics",
          product_name: "Smartphone",
        },
        {
          id: "user-id-from-traits-456", // userId should come from id field
          email: "customer@example.com",
          firstname: "Jane",
          lastname: "Smith",
          country: "Germany",
        }
      );

      expect(actualEvent.type).toEqual(JournifyEventType.PAGE);
      expect(actualEvent.userId).toEqual("user-id-from-traits-456");

      expect(actualEvent.properties).toEqual({
        path: "/products/123",
        category: "Electronics",
        product_name: "Smartphone",
      });
      expect(actualEvent.traits).toEqual({
        id: "user-id-from-traits-456",
        email: "customer@example.com",
        firstname: "Jane",
        lastname: "Smith",
        country: "Germany",
      });
    });

    it("Should create a track event with userId from traits", async function () {
      const browser = new BrowserMock();
      browser.setOnline(true);
      browser.setNavigator({ ...global.navigator });
      browser.setDocument({ ...global.document });
      browser.setLocation({ ...global.location });
      browser.setWindow({ ...window });

      const externalIdsCache = new ExternalIdsSessionCacheImpl(
        browser,
        new SessionStore(browser)
      );

      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const user = new UserImpl(stores, sentryMock);
      const consentService = new ConsentServiceMock();

      const eventFactory = new EventFactoryImpl(
        stores,
        testStores.cookies,
        browser,
        externalIdsCache,
        consentService
      );
      eventFactory.setUser(user);

      const actualEvent = await eventFactory.newTrackEvent(
        "subscription_started",
        {
          plan_type: "premium",
          billing_cycle: "monthly",
          amount: 19.99,
          currency: "USD",
        },
        {
          userId: 123, // userId in traits
          email: "subscriber@example.com",
          firstname: "Mike",
          lastname: "Johnson",
          age: 32,
          country: "Canada",
        }
      );

      expect(actualEvent.type).toEqual(JournifyEventType.TRACK);
      expect(actualEvent.event).toEqual("subscription_started");
      expect(actualEvent.userId).toEqual("123");

      expect(actualEvent.properties).toEqual({
        plan_type: "premium",
        billing_cycle: "monthly",
        amount: 19.99,
        currency: "USD",
      });
      expect(actualEvent.userId).toEqual("123");
      expect(actualEvent.traits).toEqual({
        userId: 123,
        email: "subscriber@example.com",
        firstname: "Mike",
        lastname: "Johnson",
        age: 32,
        country: "Canada",
      });
    });

    it("Should prefer traits.userId when both properties.userId and traits.userId are provided", async function () {
      const browser = new BrowserMock();
      browser.setOnline(true);
      browser.setNavigator({ ...global.navigator });
      browser.setDocument({ ...global.document });
      browser.setLocation({ ...global.location });
      browser.setWindow({ ...window });

      const externalIdsCache = new ExternalIdsSessionCacheImpl(
        browser,
        new SessionStore(browser)
      );

      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const user = new UserImpl(stores, sentryMock);
      user.load();
      const consentService = new ConsentServiceMock();

      const eventFactory = new EventFactoryImpl(
        stores,
        testStores.cookies,
        browser,
        externalIdsCache,
        consentService
      );

      const actualEvent = await eventFactory.newTrackEvent(
        "test_event",
        {
          userId: "user-from-properties",
          some_property: "value",
        },
        {
          userId: "user-from-traits",
          email: "test@example.com",
        }
      );

      expect(actualEvent.userId).toEqual("user-from-traits");
      expect(actualEvent.traits).toEqual({
        userId: "user-from-traits",
        email: "test@example.com",
      });
    });

    it("Should use user.getUserId() when available (highest priority)", async function () {
      const browser = new BrowserMock();
      browser.setOnline(true);
      browser.setNavigator({ ...global.navigator });
      browser.setDocument({ ...global.document });
      browser.setLocation({ ...global.location });
      browser.setWindow({ ...window });

      const externalIdsCache = new ExternalIdsSessionCacheImpl(
        browser,
        new SessionStore(browser)
      );

      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const user = new UserImpl(stores, sentryMock);
      user.load();
      const consentService = new ConsentServiceMock();

      const eventFactory = new EventFactoryImpl(
        stores,
        testStores.cookies,
        browser,
        externalIdsCache,
        consentService
      );

      const actualEvent = await eventFactory.newTrackEvent(
        "test_event",
        {
          userId: "user-from-properties",
          some_property: "value",
        },
        {
          userId: "user-from-traits",
          id: "user-from-id",
          email: "test@example.com",
        }
      );

      expect(actualEvent.userId).toEqual("user-from-traits");
      expect(actualEvent.traits).toEqual({
        userId: "user-from-traits",
        id: "user-from-id",
        email: "test@example.com",
      });
    });

    it("Should prefer traits.userId over traits.id when both are provided", async function () {
      const browser = new BrowserMock();
      browser.setOnline(true);
      browser.setNavigator({ ...global.navigator });
      browser.setDocument({ ...global.document });
      browser.setLocation({ ...global.location });
      browser.setWindow({ ...window });

      const externalIdsCache = new ExternalIdsSessionCacheImpl(
        browser,
        new SessionStore(browser)
      );

      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const user = new UserImpl(stores, sentryMock);
      user.load();
      const consentService = new ConsentServiceMock();

      const eventFactory = new EventFactoryImpl(
        stores,
        testStores.cookies,
        browser,
        externalIdsCache,
        consentService
      );

      const actualEvent = await eventFactory.newPageEvent(
        "test_page",
        {
          path: "/test",
        },
        {
          userId: "user-from-userId-field",
          id: "user-from-id-field",
          email: "test@example.com",
        }
      );

      expect(actualEvent.userId).toEqual("user-from-userId-field");
      expect(actualEvent.traits).toEqual({
        userId: "user-from-userId-field",
        id: "user-from-id-field",
        email: "test@example.com",
      });
    });

    it("Should fallback to traits.id when traits.userId is not provided", async function () {
      const browser = new BrowserMock();
      browser.setOnline(true);
      browser.setNavigator({ ...global.navigator });
      browser.setDocument({ ...global.document });
      browser.setLocation({ ...global.location });
      browser.setWindow({ ...window });

      const externalIdsCache = new ExternalIdsSessionCacheImpl(
        browser,
        new SessionStore(browser)
      );

      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      const sentryMock = {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      };
      const user = new UserImpl(stores, sentryMock);
      user.load();
      const consentService = new ConsentServiceMock();

      const eventFactory = new EventFactoryImpl(
        stores,
        testStores.cookies,
        browser,
        externalIdsCache,
        consentService
      );
      eventFactory.setUser(user);

      const actualEvent = await eventFactory.newPageEvent(
        "test_page",
        {
          path: "/test",
        },
        {
          id: "user-from-id-only",
          email: "test@example.com",
        }
      );

      expect(actualEvent.userId).toEqual("user-from-id-only");
      expect(actualEvent.traits).toEqual({
        id: "user-from-id-only",
        email: "test@example.com",
      });
    });
  });

  describe("twitter_click_id external id", () => {
    async function getTwitterClickId(cookieValue: unknown) {
      const browser = new BrowserMock();
      browser.setNavigator({ ...global.navigator });
      browser.setDocument({ ...global.document });
      browser.setLocation({ ...global.location, search: "" });
      browser.setWindow({ ...window });
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      testStores.cookies.set("_twclid", cookieValue);

      const eventFactory = new EventFactoryImpl(
        stores,
        testStores.cookies,
        browser,
        new ExternalIdsSessionCacheImpl(browser, new SessionStore(browser)),
        new ConsentServiceMock()
      );
      eventFactory.setUser(new UserMock("user-id", uuid.v4(), {}, {}, {}));

      const event = await eventFactory.newTrackEvent("test_event");
      return event.externalIds?.twitter_click_id;
    }

    it("Should read twclid from an already parsed cookie object", async function () {
      const twclid = await getTwitterClickId({ twclid: "twclid-123" });
      expect(twclid).toEqual("twclid-123");
    });

    it("Should read twclid from an encoded JSON cookie string", async function () {
      const twclid = await getTwitterClickId(
        encodeURI(JSON.stringify({ twclid: "twclid-456" }))
      );
      expect(twclid).toEqual("twclid-456");
    });

    it("Should return the raw cookie when it is a plain string", async function () {
      const twclid = await getTwitterClickId("twclid-raw-789");
      expect(twclid).toEqual("twclid-raw-789");
    });

    it("Should not return [object Object] when the parsed cookie has no twclid", async function () {
      const twclid = await getTwitterClickId({ other: "value" });
      expect(twclid).toBeUndefined();
    });
  });

  describe("facebook_click_id external id", () => {
    const SESSION_ID = 1700000000000;

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function newEventFactory(
      search: string,
      cookies: Record<string, string> = {},
      hostname = "www.example.com"
    ) {
      const browser = new BrowserMock();
      browser.setNavigator({ ...global.navigator });
      browser.setDocument({ ...global.document });
      browser.setLocation({
        ...global.location,
        search,
        hostname,
        href: `https://${hostname}/${search}`,
      });
      browser.setWindow({ ...window });
      const testStores = createStoresForTest();
      const stores = new StoresGroup(
        testStores.local,
        testStores.cookies,
        testStores.memory
      );
      stores.set(SESSION_ID_PERSISTENCE_KEY, SESSION_ID);
      Object.entries(cookies).forEach(([key, value]) =>
        testStores.cookies.set(key, value)
      );

      const eventFactory = new EventFactoryImpl(
        stores,
        testStores.cookies,
        browser,
        new ExternalIdsSessionCacheImpl(browser, new SessionStore(browser)),
        new ConsentServiceMock()
      );
      eventFactory.setUser(new UserMock("user-id", uuid.v4(), {}, {}, {}));

      return { eventFactory, testStores };
    }

    async function getFacebookClickId(eventFactory: EventFactoryImpl) {
      const event = await eventFactory.newPageEvent("page");
      return event.externalIds?.facebook_click_id;
    }

    it("Should return the _fbc cookie when there is no fbclid in the url", async function () {
      const { eventFactory } = newEventFactory("", { _fbc: "fb.1.111.old" });
      expect(await getFacebookClickId(eventFactory)).toEqual("fb.1.111.old");
    });

    it("Should not build a value when there is neither fbclid nor _fbc", async function () {
      const { eventFactory } = newEventFactory("");
      expect(await getFacebookClickId(eventFactory)).toBeUndefined();
    });

    it("Should return the _fbc cookie as is when the url has a fbclid", async function () {
      const { eventFactory } = newEventFactory("?fbclid=abc", {
        _fbc: "fb.1.111.abc.AQ",
      });
      expect(await getFacebookClickId(eventFactory)).toEqual(
        "fb.1.111.abc.AQ"
      );
    });

    it("Should return the _fbc cookie as is even when it is from another click", async function () {
      const findRootCookieDomain = jest.spyOn(cookiesStoreModule, "findRootCookieDomain");
      const { eventFactory } = newEventFactory("?fbclid=new", {
        _fbc: "fb.1.111.old",
      });
      expect(await getFacebookClickId(eventFactory)).toEqual("fb.1.111.old");
      expect(findRootCookieDomain).not.toHaveBeenCalled();
    });

    it("Should build _fbc from fbclid when the pixel has not stored it yet", async function () {
      jest.spyOn(cookiesStoreModule, "findRootCookieDomain").mockReturnValue("example.com");
      const { eventFactory } = newEventFactory("?fbclid=abc");
      expect(await getFacebookClickId(eventFactory)).toEqual(
        `fb.1.${SESSION_ID}.abc`
      );
    });

    it("Should build the same _fbc value for every event of the session", async function () {
      jest.spyOn(cookiesStoreModule, "findRootCookieDomain").mockReturnValue("example.com");
      const { eventFactory } = newEventFactory("?fbclid=abc");
      const first = await getFacebookClickId(eventFactory);
      const second = await getFacebookClickId(eventFactory);
      expect(second).toEqual(first);
    });

    it("Should use the subdomain index of the root domain", async function () {
      jest.spyOn(cookiesStoreModule, "findRootCookieDomain").mockReturnValue("example.co.uk");
      const { eventFactory } = newEventFactory(
        "?fbclid=abc",
        {},
        "shop.example.co.uk"
      );
      expect(await getFacebookClickId(eventFactory)).toEqual(
        `fb.2.${SESSION_ID}.abc`
      );
    });

    it("Should reuse the subdomain index of the _fbp cookie", async function () {
      const findRootCookieDomain = jest.spyOn(cookiesStoreModule, "findRootCookieDomain");
      const { eventFactory } = newEventFactory("?fbclid=abc", {
        _fbp: "fb.2.1600000000000.123456789",
      });
      expect(await getFacebookClickId(eventFactory)).toEqual(
        `fb.2.${SESSION_ID}.abc`
      );
      expect(findRootCookieDomain).not.toHaveBeenCalled();
    });

    it("Should fall back to the hostname when no root domain is found", async function () {
      jest.spyOn(cookiesStoreModule, "findRootCookieDomain").mockReturnValue(undefined);
      const { eventFactory } = newEventFactory("?fbclid=abc", {}, "localhost");
      expect(await getFacebookClickId(eventFactory)).toEqual(
        `fb.0.${SESSION_ID}.abc`
      );
    });

    it("Should encode dots of the fbclid like the pixel does", async function () {
      jest.spyOn(cookiesStoreModule, "findRootCookieDomain").mockReturnValue("example.com");
      const { eventFactory } = newEventFactory("?fbclid=a.b");
      expect(await getFacebookClickId(eventFactory)).toEqual(
        `fb.1.${SESSION_ID}.a__DOT__b`
      );
    });
  });
});
