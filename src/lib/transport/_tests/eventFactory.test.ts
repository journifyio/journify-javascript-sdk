import * as uuid from "uuid";
import { EventFactoryImpl } from "../eventFactory";
import { UserMock } from "../../../test/mocks/user";
import { User, UserImpl } from "../../domain/user";
import { Traits } from "../../domain/traits";
import {
  JournifyEvent,
  JournifyEventType,
  UtmCampaign,
} from "../../domain/event";
import { LIB_VERSION } from "../../generated/libVersion";
import { StoresGroup } from "../../store/store";
import { createStoresForTest } from "../../../test/helpers/stores";
import { BrowserMock } from "../../../test/mocks/browser";
import {
  ExternalIds,
  ExternalIdsSessionCacheImpl,
} from "../../domain/externalId";
import { SessionStore } from "../../store/sessionStore";

import { TextEncoder, TextDecoder } from "util";
import { ConsentServiceMock } from "../../../test/mocks/consentService";

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

      const sq =
        "?ttclid=tiktok-click-id-93893&ScCid=snap-click-id-87388&utm_source=campaign-source-123&utm_medium=campaign-medium-123&utm_campaign=campaign-name-123&utm_id=campaign-id-123&utm_term=campaign-term-123&utm_content=campaign-content-123";
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
            country: 'MA',
            categoryPreferences: {},
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
          userId: "user-from-traits-789", // userId in traits
          email: "subscriber@example.com",
          firstname: "Mike",
          lastname: "Johnson",
          age: 32,
          country: "Canada",
        }
      );

      expect(actualEvent.type).toEqual(JournifyEventType.TRACK);
      expect(actualEvent.event).toEqual("subscription_started");
      expect(actualEvent.userId).toEqual("user-from-traits-789");

      expect(actualEvent.properties).toEqual({
        plan_type: "premium",
        billing_cycle: "monthly",
        amount: 19.99,
        currency: "USD",
      });
      expect(actualEvent.userId).toEqual("user-from-traits-789");
      expect(actualEvent.traits).toEqual({
        userId: "user-from-traits-789",
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
});
