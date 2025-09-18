import { GA4Pixel } from "../ga4Pixel";
import { BrowserMock } from "../../../../../test/mocks/browser";
import {
  FieldsMapperFactoryMock,
  FieldsMapperMock,
} from "../../../../../test/mocks/mapping";
import { UserMock } from "../../../../../test/mocks/user";
import { PluginDependencies } from "../../plugin";
import { EventMapperFactoryImpl } from "../../lib/mapping";
import { ContextFactoryImpl } from "../../../context";
import { JournifyEventType } from "../../../../domain/event";
import { randomUUID } from "crypto";

describe("GA4 Pixel", () => {
  let browser;
  let user;
  let mesurementId;
  let time;

  beforeEach(() => {
    browser = new BrowserMock();
    browser.setDocument(document);
    browser.setWindow(window);
    browser.setInjectScriptFn(jest.fn());
    user = new UserMock(randomUUID(), randomUUID(), {}, {});
    mesurementId = "G-XXXXXXXXXX";
    time = "2024-05-14T15:41:51.787Z";
    jest.useFakeTimers().setSystemTime(new Date(time));
  });

  it("should load the GA4 script", () => {
    const fieldMapper = new FieldsMapperMock(() => {
      return {};
    });
    const deps: PluginDependencies = {
      sync: {
        id: "sync_id",
        destination_app: "ga4_pixel",
        settings: [
          {
            key: "mesurement_id",
            value: mesurementId,
          },
          {
            key: "cookie_prefix",
            value: "ga4_",
          },
          {
            key: "cookie_domain",
            value: "example.com",
          },
          {
            key: "cookie_expires",
            value: 3600, // 1 hour
          },
        ],
        field_mappings: [],
        event_mappings: [],
      },
      user,
      sentry: {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      },
      fieldMapperFactory: new FieldsMapperFactoryMock(() => fieldMapper),
      eventMapperFactory: new EventMapperFactoryImpl(),
      testingWriteKey: false,
      browser: browser,
      logger: console,
    };
    // // eslint-disable-next-line @typescript-eslint/no-empty-function
    // const gtag = jest.fn(() => {});
    // browser.setWindow({
    //   ...browser.window(),
    //   gtag,
    // });
    const plugin = new GA4Pixel(deps);
    expect(plugin).toBeDefined();

    expect(browser.window().JDataLayer).toBeDefined();
    expect(browser.window().JDataLayer).toBeInstanceOf(Array);
    expect(browser.window().JDataLayer[0][0]).toEqual("js");
    expect(browser.window().JDataLayer[0][1]).toEqual(new Date(time));
    expect(browser.window().JDataLayer[1][0]).toEqual("config");
    expect(browser.window().JDataLayer[1][1]).toEqual(mesurementId);
    expect(browser.window().JDataLayer[1][2]).toEqual({
      cookie_domain: "example.com",
      cookie_prefix: "ga4_",
      cookie_expires: 3600,
    });
  });

  it("should add to cart event", () => {
    const fieldMapper = new FieldsMapperMock(() => {
      return {};
    });
    const deps: PluginDependencies = {
      sync: {
        id: "sync_id",
        destination_app: "ga4_pixel",
        settings: [
          {
            key: "mesurement_id",
            value: mesurementId,
          },
        ],
        field_mappings: [],
        event_mappings: [],
      },
      user,
      sentry: {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      },
      fieldMapperFactory: new FieldsMapperFactoryMock(() => fieldMapper),
      eventMapperFactory: new EventMapperFactoryImpl(),
      testingWriteKey: false,
      browser: browser,
      logger: console,
    };

    const plugin = new GA4Pixel(deps);
    expect(plugin).toBeDefined();
    plugin.track(
      new ContextFactoryImpl().newContext(
        {
          type: JournifyEventType.TRACK,
          event: "add_to_cart",
          properties: {
            value: "323.12",
            currency: "USD",
          },
        },
        randomUUID()
      )
    );
    expect(browser.window().gtag).toBeDefined();
    const lastItem = browser.window().JDataLayer.pop();
    expect(lastItem[0]).toBe("event");
    expect(lastItem[1]).toBe("add_to_cart");
    expect(lastItem[2]).toEqual({
      send_to: mesurementId,
      value: "323.12",
      currency: "USD",
    });
  });

  it("should send page view event", () => {
    const fieldMapper = new FieldsMapperMock(() => {
      return {};
    });
    const deps: PluginDependencies = {
      sync: {
        id: "sync_id",
        destination_app: "ga4_pixel",
        settings: [
          {
            key: "mesurement_id",
            value: mesurementId,
          },
        ],
        field_mappings: [],
        event_mappings: [],
      },
      user,
      sentry: {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      },
      fieldMapperFactory: new FieldsMapperFactoryMock(() => fieldMapper),
      eventMapperFactory: new EventMapperFactoryImpl(),
      testingWriteKey: false,
      browser: browser,
      logger: console,
    };

    const plugin = new GA4Pixel(deps);
    expect(plugin).toBeDefined();
    plugin.page(
      new ContextFactoryImpl().newContext(
        {
          type: JournifyEventType.PAGE,
          context: {
            page: {
              path: "/checkout",
            },
          },
        },
        randomUUID()
      )
    );
    expect(browser.window().gtag).toBeDefined();
    const lastItem = browser.window().JDataLayer.pop();
    expect(lastItem[0]).toBe("event");
    expect(lastItem[1]).toBe("page_view");
  });
});
