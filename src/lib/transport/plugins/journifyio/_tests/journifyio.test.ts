import { enableFetchMocks } from "jest-fetch-mock";
import { SdkSettings } from "../../plugin";
import { ContextFactoryImpl } from "../../../context";
import { JournifyEvent, JournifyEventType } from "../../../../domain/event";
import { randomUUID } from "node:crypto";
import { JournifyioPlugin } from "../journifyio";
import { LIB_VERSION } from "../../../../generated/libVersion";
enableFetchMocks();

const contextFactory = new ContextFactoryImpl();
describe("Journifyio plugin", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should send track event with plain PII to the tracking api", async () => {
    const trackEvent: JournifyEvent = {
      messageId: randomUUID(),
      type: JournifyEventType.TRACK,
      externalIds: {
        facebook_click_id: "facebook-click-id-example",
        pinterest_click_id: "pinterest-click-id-example",
        facebook_browser_id: "facebook-browser-id-example",
        snapchat_scid: "snapchat-scid-example",
        tiktok_ttp: "tiktok-ttp-example",
      },
      userId: randomUUID(),
      anonymousId: randomUUID(),
      event: "purchase",
      traits: {
        email: "user@example.com",
        phone: "+1234567890",
        firstname: "John",
        lastname: "Doe",
      },
      timestamp: new Date(),
      context: {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        library: {
          name: "@journifyio/js-sdk",
          version: LIB_VERSION,
        },
        locale: "'en-US'",
        page: {
          path: "/product/1093892",
          referrer: "https://www.google.com",
          search: "?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale",
          title: "Product 1093892",
          url: "https://www.example.com/product/1093892",
        },
        campaign: {
          id: "12345",
          name: "summer_sale",
          source: "google",
          medium: "cpc",
          term: "running+shoes",
          content: "ad-1",
        },
      },
    };
    const expectedPayload = { ...trackEvent };
    await testJournifyPlugin(trackEvent, expectedPayload);
  });

  it("should send track event to the tracking api after hashed PII", async () => {
    const trackEvent: JournifyEvent = {
      messageId: randomUUID(),
      type: JournifyEventType.TRACK,
      externalIds: {
        facebook_click_id: "facebook-click-id-example",
        pinterest_click_id: "pinterest-click-id-example",
        facebook_browser_id: "facebook-browser-id-example",
        snapchat_scid: "snapchat-scid-example",
        tiktok_ttp: "tiktok-ttp-example",
        address: "address example",
      },
      userId: randomUUID(),
      anonymousId: randomUUID(),
      event: "purchase",
      traits: {
        email: "user@example.com",
        hashed_phone:
          "422ce82c6fc1724ac878042f7d055653ab5e983d186e616826a72d4384b68af8",
        firstname: " John",
        lastname: "Doe  ",
      },
      timestamp: new Date(),
      context: {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        library: {
          name: "@journifyio/js-sdk",
          version: LIB_VERSION,
        },
        locale: "'en-US'",
        page: {
          path: "/product/1093892",
          referrer: "https://www.google.com",
          search: "?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale",
          title: "Product 1093892",
          url: "https://www.example.com/product/1093892",
        },
        campaign: {
          id: "12345",
          name: "summer_sale",
          source: "google",
          medium: "cpc",
          term: "running+shoes",
          content: "ad-1",
        },
      },
    };
    const expectedPayload = {
      ...trackEvent,
      externalIds: {
        ...trackEvent.externalIds,
        address:
          "0d68b11e30a205b76386cacb7b6bfbc554dd50830614190834a1ec120669ff8d",
      },
      traits: {
        email:
          "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514",
        firstname:
          "96d9632f363564cc3032521409cf22a852f2032eec099ed5967c0d000cec607a",
        lastname:
          "799ef92a11af918e3fb741df42934f3b568ed2d93ac1df74f1b8d41a27932a6f",
        phone:
          "422ce82c6fc1724ac878042f7d055653ab5e983d186e616826a72d4384b68af8",
      },
    };
    await testJournifyPlugin(trackEvent, expectedPayload, {
      enableHashing: true,
    });
  });
});

async function testJournifyPlugin(
  event: JournifyEvent,
  expectedPayload: object,
  options: {
    enableHashing: boolean;
  } = { enableHashing: false }
) {
  const fetchMock = jest.fn().mockReturnValue({ ok: true });
  global.fetch = fetchMock;

  const settings: SdkSettings = {
    writeKey: "wk_139fjskfjsdkljflskdjflkds",
    apiHost: "https://t.lvh.me",
    options: {
      enableHashing: options.enableHashing,
    },
  };
  const sentryMock = {
    setTag: jest.fn(),
    setResponse: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
  };
  const plugin = new JournifyioPlugin(settings, sentryMock);

  const ctx = contextFactory.newContext(event, randomUUID());
  const newCtx = await plugin.track(ctx);
  expect(newCtx).toEqual(ctx);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const expectedEndpoint = `${settings.apiHost}/v1/${event.type.charAt(0)}`;
  expect(fetchMock).toHaveBeenCalledWith(expectedEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...expectedPayload,
      writeKey: settings.writeKey,
    }),
    keepalive: true,
  });
}
