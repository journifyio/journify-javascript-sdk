/* eslint-disable  @typescript-eslint/no-explicit-any */
import { GoogleAdsGtag } from "../googleAdsGtag";
import {
  FieldMapping,
  FieldMappingSourceType,
  PluginDependencies,
  TrackingEventType,
} from "../../plugin";
import { UserMock } from "../../../../../test/mocks/user";
import { BrowserMock } from "../../../../../test/mocks/browser";
import {
  FieldsMapperFactoryMock,
  FieldsMapperMock,
} from "../../../../../test/mocks/mapping";
import { JournifyEvent, JournifyEventType } from "../../../../domain/event";
import { randomUUID } from "node:crypto";
import { ContextFactoryImpl } from "../../../context";
import { EventMapperFactoryImpl } from "../../lib/mapping";

describe("Google Ads Gtag", () => {
  it("should inject gtag script on the page and initialize it with user data", () => {
    const browser = new BrowserMock();
    browser.setWindow({ ...window });

    const dataLayer = {
      ...[],
      push: jest.fn(),
    };
    const injectScriptFunc = jest.fn(() => {
      browser.window().dataLayer = dataLayer;
    });
    browser.setInjectScriptFn(injectScriptFunc);
    browser.setScriptAlreadyInPageFn(() => false);

    const user = new UserMock(
      randomUUID(),
      randomUUID(),
      { email: "Email@Example.com", phone: "+1231234567890" },
      {}
    );
    const generatedGtagId = generateGtagId();
    const fieldMapper = new FieldsMapperMock(() => {
      return {
        email: "Email@Example.com",
        phone_number: "+1231234567890",
      };
    });
    const dependencies: PluginDependencies = {
      sync: {
        id: "sync_id",
        destination_app: "google_ads_gtag",
        settings: [
          {
            key: "google_ads_gtag_id",
            value: generatedGtagId,
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
      eventMapperFactory: new EventMapperFactoryImpl(),
      fieldMapperFactory: new FieldsMapperFactoryMock(() => fieldMapper),
      browser: browser,
      testingWriteKey: false,
      logger: console,
    };
    const plugin = new GoogleAdsGtag(dependencies);

    expect(plugin).toBeDefined();
    expect(injectScriptFunc).toHaveBeenCalledTimes(1);
    expect(injectScriptFunc).toHaveBeenCalledWith(
      `https://www.googletagmanager.com/gtag/js?id=${generatedGtagId}`,
      { async: true }
    );

    const unwrapArgumentsCall = (mockFn: jest.Mock, nth: number) => {
      return Array.from(mockFn.mock.calls[nth - 1][0]);
    };
    expect(dataLayer.push).toHaveBeenCalledTimes(3);
    expect(unwrapArgumentsCall(dataLayer.push, 1)).toEqual([
      "set",
      "user_data",
      {
        email: "Email@Example.com",
        phone_number: "+1231234567890",
      },
    ]);
    expect(unwrapArgumentsCall(dataLayer.push, 2)).toEqual([
      "js",
      expect.anything(),
    ]);
    expect(unwrapArgumentsCall(dataLayer.push, 3)).toEqual([
      "config",
      generatedGtagId,
    ]);
  });

  it("should not inject gtag script on the page if it's already on the page", () => {
    const browser = new BrowserMock();
    browser.setWindow({ ...window });

    const dataLayer = {
      ...[],
      push: jest.fn(),
    };
    browser.window().dataLayer = dataLayer;
    const injectScriptFunc = jest.fn();
    browser.setInjectScriptFn(injectScriptFunc);
    const scriptAlreadyInPage = jest.fn(() => true);
    browser.setScriptAlreadyInPageFn(scriptAlreadyInPage);

    const user = new UserMock(
      randomUUID(),
      randomUUID(),
      { email: "Email@Example.com", phone: "+1231234567890" },
      {}
    );
    const generatedGtagId = generateGtagId();
    const fieldMapper = new FieldsMapperMock(() => {
      return {
        email: "Email@Example.com",
        phone_number: "+1231234567890",
      };
    });
    const dependencies: PluginDependencies = {
      sync: {
        id: "sync_id",
        destination_app: "google_ads_gtag",
        settings: [
          {
            key: "google_ads_gtag_id",
            value: generatedGtagId,
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
      eventMapperFactory: new EventMapperFactoryImpl(),
      fieldMapperFactory: new FieldsMapperFactoryMock(() => fieldMapper),
      browser: browser,
      testingWriteKey: false,
      logger: console,
    };
    const plugin = new GoogleAdsGtag(dependencies);

    expect(plugin).toBeDefined();
    expect(injectScriptFunc).toHaveBeenCalledTimes(0);
    expect(scriptAlreadyInPage).toHaveBeenCalledWith(
      `https://www.googletagmanager.com/gtag/js?id=${generatedGtagId}`
    );

    const unwrapArgumentsCall = (mockFn: jest.Mock, nth: number) => {
      return Array.from(mockFn.mock.calls[nth - 1][0]);
    };
    expect(dataLayer.push).toHaveBeenCalledTimes(3);
    expect(unwrapArgumentsCall(dataLayer.push, 1)).toEqual([
      "set",
      "user_data",
      {
        email: "Email@Example.com",
        phone_number: "+1231234567890",
      },
    ]);
    expect(unwrapArgumentsCall(dataLayer.push, 2)).toEqual([
      "js",
      expect.anything(),
    ]);
    expect(unwrapArgumentsCall(dataLayer.push, 3)).toEqual([
      "config",
      generatedGtagId,
    ]);
  });

  it("should send a WEBPAGE conversion event to google", () => {
    const sourceEventName = "add_to_cart";
    const conversionLabel = "zqdUPATg1rgZENSkdsklv4o";
    const conversionType = "WEBPAGE";
    testSendingEvent(
      TrackingEventType.TRACK_EVENT,
      sourceEventName,
      conversionLabel,
      conversionType
    );
  });

  it("should send an UPLOAD_CALLS conversion event to google", () => {
    const sourceEventName = "call_purchase";
    const conversionLabel = "zqdUPATgfklssdlfjNSkdsklv4o";
    const conversionType = "UPLOAD_CALLS";
    testSendingEvent(
      TrackingEventType.TRACK_EVENT,
      sourceEventName,
      conversionLabel,
      conversionType
    );
  });
});

function generateGtagId(): string {
  return "AW-" + Math.floor(Math.random() * 10000000).toString();
}

function testSendingEvent(
  eventType: TrackingEventType,
  sourceEventName: string,
  conversionLabel: string,
  conversionType: string
) {
  // initialize the plugin
  const generatedGtagId = generateGtagId();
  const eventKey = `${generatedGtagId}/${conversionLabel}/${conversionType}`;
  const eventMappings = [
    {
      enabled: true,
      destination_event_key: eventKey,
      event_type: eventType,
      event_name: sourceEventName,
    },
  ];
  const fieldsMappings: FieldMapping[] = [
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.email",
      },
      target: { name: "email" },
    },
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.phone",
      },
      target: { name: "phone_conversion_number" },
    },
  ];
  const fieldsMapper = new FieldsMapperMock(() => {
    return {};
  });

  const fieldMapperFactory = new FieldsMapperFactoryMock(
    (mappingsParam: FieldMapping[]) => {
      expect(mappingsParam).toBe(fieldsMappings);
      return fieldsMapper;
    }
  );

  const dataLayerPushFunc = jest.fn();
  const browser = new BrowserMock();
  browser.setWindow({ ...window });
  const injectScriptFunc = jest.fn(() => {
    browser.window().dataLayer = {
      ...[],
      push: dataLayerPushFunc,
    };
  });

  browser.setInjectScriptFn(injectScriptFunc);
  browser.setScriptAlreadyInPageFn(() => false);

  const dependencies: PluginDependencies = {
    sync: {
      id: randomUUID(),
      destination_app: "google_ads_gtag",
      settings: [
        {
          key: "google_ads_gtag_id",
          value: generatedGtagId,
        },
      ],
      field_mappings: fieldsMappings,
      event_mappings: eventMappings,
    },
    user: new UserMock(randomUUID(), randomUUID(), {}, {}),
    sentry: {
      setTag: jest.fn(),
      setResponse: jest.fn(),
      captureException: jest.fn(),
      captureMessage: jest.fn(),
    },
    eventMapperFactory: new EventMapperFactoryImpl(),
    fieldMapperFactory: fieldMapperFactory,
    browser: browser,
    testingWriteKey: false,
    logger: console,
  };

  const plugin = new GoogleAdsGtag(dependencies);
  expect(plugin).toBeDefined();

  // initialize the event
  const ctx = new ContextFactoryImpl().newContext({
    type: eventType.toString() as JournifyEventType,
    event: sourceEventName,
    properties: {
      value: 1000,
      item_id: "123",
    },
  });

  const mapEventFunc = jest.fn((eventParam: JournifyEvent) => {
    expect(eventParam).toBe(ctx.getEvent());
    return {
      conversionAction: eventKey,
      email: "example@example.com",
      phone_number: "+1738829238921",
      phone_conversion_number: "+1738829238921",
      value: 1000,
      currency: "AED",
    };
  });
  fieldsMapper.setMapEventFunc(mapEventFunc);

  dataLayerPushFunc.mockClear();
  dataLayerPushFunc.mockImplementation((args: any[]) => {
    const [callType, arg2, properties] = args;
    switch (conversionType) {
      case "UPLOAD_CALLS":
        expect(callType).toBe("config");
        expect(arg2).toBe(`${generatedGtagId}/${conversionLabel}`);
        expect(properties).toEqual({
          phone_conversion_number: "+1738829238921",
          value: 1000,
          currency: "AED",
        });
        break;
      default:
        expect(callType).toBe("event");
        expect(arg2).toBe("conversion");
        expect(properties).toEqual({
          send_to: `${generatedGtagId}/${conversionLabel}`,
          value: 1000,
          currency: "AED",
        });
    }
  });

  // track the event
  switch (eventType) {
    case TrackingEventType.TRACK_EVENT:
      plugin.track(ctx);
      break;
    case TrackingEventType.PAGE_EVENT:
      plugin.page(ctx);
      break;
    case TrackingEventType.IDENTIFY_EVENT:
      plugin.identify(ctx);
      break;
    case TrackingEventType.GROUP_EVENT:
      plugin.group(ctx);
      break;

    default:
      throw new Error("Invalid event type");
  }

  // assertions
  expect(mapEventFunc).toHaveBeenCalledTimes(1);
  expect(dataLayerPushFunc).toHaveBeenCalledTimes(1);
}
