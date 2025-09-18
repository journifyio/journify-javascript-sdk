/* eslint-disable  @typescript-eslint/no-explicit-any */
import { FacebookPixel } from "../facebookPixel";
import {
  EventMapping,
  FieldMapping,
  FieldMappingSourceType,
  FilterOperator,
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
import {
  facebookBirthday,
  oneLetterGender,
  toDigitsOnlyPhone,
  toLowerCase,
  Transformation,
  trim,
} from "../../lib/tranformations";
import { randomUUID } from "node:crypto";
import { User } from "../../../../domain/user";
import { ContextFactoryImpl } from "../../../context";
import {
  EventMapperFactoryImpl,
  FieldsMapperFactoryImpl,
} from "../../lib/mapping";

const FACEBOOK_SCRIPT_URL = "https://connect.facebook.net/en_US/fbevents.js";
describe("FacebookPixel plugin", () => {
  it("should inject facebook pixel script on the page", () => {
    const browser = new BrowserMock();
    browser.setWindow({ ...window });

    const fbqFunc = jest.fn();
    const injectScriptFunc = jest.fn(() => {
      const w = { ...window };
      w.fbq = fbqFunc;
      browser.setWindow(w);
    });
    browser.setInjectScriptFn(injectScriptFunc);

    const user = new UserMock(randomUUID(), randomUUID(), {}, {});
    const generatedPixelId = generatePixelId();
    const fieldMapper = new FieldsMapperMock(() => {
      return {};
    });
    const dependencies: PluginDependencies = {
      sync: {
        id: "sync_id",
        destination_app: "facebook_pixel",
        settings: [
          {
            key: "pixel_id",
            value: generatedPixelId,
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
    const plugin = new FacebookPixel(dependencies);

    expect(plugin).toBeDefined();
    expect(injectScriptFunc).toHaveBeenCalledTimes(1);
    expect(injectScriptFunc).toHaveBeenCalledWith(FACEBOOK_SCRIPT_URL, {
      async: true,
    });
    expect(fbqFunc).toHaveBeenCalledTimes(1);
    expect(fbqFunc).toHaveBeenCalledWith("init", generatedPixelId, {});
  });

  it("should initialize the facebook pixel with user data", () => {
    const generatedPixelId = generatePixelId();
    const mappedUserData = {
      em: "Email@Example.com",
      ph: "1231234567890",
    };

    const fbqFunc = jest.fn();

    const user = new UserMock(
      randomUUID(),
      randomUUID(),
      { email: "Email@Example.com", ph: "+1231234567890" },
      {}
    );

    const mapEventFunc = jest.fn(
      (
        event: JournifyEvent,
        transformationsMap?: Record<string, Transformation[]>
      ): object => {
        expect(event).toEqual({
          type: JournifyEventType.IDENTIFY,
          userId: user.getUserId(),
          anonymousId: user.getAnonymousId(),
          traits: user.getTraits(),
        });

        expect(transformationsMap).toEqual({
          em: [trim, toLowerCase],
          fn: [trim, toLowerCase],
          ln: [trim, toLowerCase],
          ph: [toDigitsOnlyPhone],
          city: [trim, toLowerCase],
          st: [trim, toLowerCase],
          country: [toLowerCase],
          ge: [oneLetterGender, toLowerCase],
          db: [facebookBirthday],
        });

        return mappedUserData;
      }
    );

    testInit(generatedPixelId, fbqFunc, mapEventFunc, user);
    expect(fbqFunc).toHaveBeenCalledTimes(1);
    expect(fbqFunc).toHaveBeenCalledWith(
      "init",
      generatedPixelId,
      mappedUserData
    );
    expect(mapEventFunc).toHaveBeenCalledTimes(1);
  });

  it("should identify the user on facebook and ignore the identify event if it it's not on the event mappings", () => {
    const generatedPixelId = generatePixelId();
    const mappedUserData = {
      firstname: "John",
      lastname: "Doe",
    };
    const fbqFunc = jest.fn(
      (method: string, pixelID: string, userData: object) => {
        expect(method).toBe("init");
        expect(pixelID).toBe(generatedPixelId);
        expect(userData).toEqual(mappedUserData);
      }
    );

    const user = new UserMock(
      randomUUID(),
      randomUUID(),
      { firstname: "John" },
      {}
    );

    const mapEventFunc = jest.fn(
      (
        event: JournifyEvent,
        transformationsMap?: Record<string, Transformation[]>
      ): object => {
        expect(event).toEqual({
          type: JournifyEventType.IDENTIFY,
          userId: user.getUserId(),
          anonymousId: user.getAnonymousId(),
          traits: user.getTraits(),
        });

        expect(transformationsMap).toEqual({
          em: [trim, toLowerCase],
          fn: [trim, toLowerCase],
          ln: [trim, toLowerCase],
          ph: [toDigitsOnlyPhone],
          city: [trim, toLowerCase],
          st: [trim, toLowerCase],
          country: [toLowerCase],
          ge: [oneLetterGender, toLowerCase],
          db: [facebookBirthday],
        });

        return mappedUserData;
      }
    );

    const plugin = testInit(generatedPixelId, fbqFunc, mapEventFunc, user);
    expect(fbqFunc).toHaveBeenCalledTimes(1);

    user.setUserId(randomUUID());
    user.setAnonymousId(randomUUID());
    user.setTraits({ lastname: "Doe" });

    plugin.identify(
      new ContextFactoryImpl().newContext(
        { type: JournifyEventType.IDENTIFY },
        randomUUID()
      )
    );

    expect(mapEventFunc).toHaveBeenCalledTimes(2);
    expect(fbqFunc).toHaveBeenCalledTimes(2);
  });

  it("should send the identify event to facebook pixel when it's mapped and mapping is enabled", () => {
    const facebookEventName = "ViewContent";
    const generatedPixelId = generatePixelId();
    const deduplicationId = randomUUID();
    const mappedUserData = {
      state: "NY",
      event_id: deduplicationId,
    };
    const fbqFunc = jest.fn(
      (
        method: string,
        pixelId: string,
        param3: object | string,
        properties?: object,
        metadata?: object
      ) => {
        expect(pixelId).toBe(generatedPixelId);
        switch (method) {
          case "init":
            expect(param3).toEqual(mappedUserData);
            break;
          case "trackSingle":
            expect(param3).toBe(facebookEventName);
            expect(properties).toEqual({
              state: "NY",
              currency: "USD",
            });

            expect(metadata).toEqual({
              eventID: deduplicationId,
            });
            break;
        }
      }
    );

    const user = new UserMock(
      randomUUID(),
      randomUUID(),
      { firstname: "John" },
      {}
    );

    const mapEventFunc = jest.fn(
      (
        event: JournifyEvent,
        transformationsMap?: Record<string, Transformation[]>
      ): object => {
        const expectedValues = [
          {
            type: JournifyEventType.IDENTIFY,
            userId: user.getUserId(),
            anonymousId: user.getAnonymousId(),
            traits: user.getTraits(),
          },
          {
            type: JournifyEventType.IDENTIFY,
            userId: newUserID,
            anonymousId: user.getAnonymousId(),
            traits: user.getTraits(),
          },
          {
            type: JournifyEventType.IDENTIFY,
            userId: newUserID,
          },
        ];
        expect(expectedValues).toContainEqual(event);

        if (event.traits) {
          expect(transformationsMap).toEqual({
            em: [trim, toLowerCase],
            fn: [trim, toLowerCase],
            ln: [trim, toLowerCase],
            ph: [toDigitsOnlyPhone],
            city: [trim, toLowerCase],
            st: [trim, toLowerCase],
            country: [toLowerCase],
            ge: [oneLetterGender, toLowerCase],
            db: [facebookBirthday],
          });
        }

        return mappedUserData;
      }
    );

    const plugin = testInit(generatedPixelId, fbqFunc, mapEventFunc, user, [
      {
        enabled: true,
        destination_event_key: facebookEventName,
        event_type: TrackingEventType.IDENTIFY_EVENT,
      },
    ]);
    expect(fbqFunc).toHaveBeenCalledTimes(1);

    const newUserID = randomUUID();
    plugin.identify(
      new ContextFactoryImpl().newContext(
        {
          type: JournifyEventType.IDENTIFY,
          userId: newUserID,
        },
        randomUUID()
      )
    );

    expect(mapEventFunc).toHaveBeenCalledTimes(3);
    expect(fbqFunc).toHaveBeenCalledTimes(3);
  });

  it("should send a standard track event to facebook pixel when it's mapped and mapping is enabled", () => {
    const sourceEventName = "add_to_cart";
    const facebookEventName = "AddToCart";
    testSendingEvent(
      TrackingEventType.TRACK_EVENT,
      facebookEventName,
      true,
      sourceEventName
    );
  });

  it("should send a non-standard track event to facebook pixel when it's mapped and mapping is enabled", () => {
    const sourceEventName = "add_to_cart";
    const facebookEventName = "Custom event 123";
    testSendingEvent(
      TrackingEventType.TRACK_EVENT,
      facebookEventName,
      false,
      sourceEventName
    );
  });

  it("should not send a track event to facebook pixel when it's not mapped", () => {
    const eventMappings = [
      {
        enabled: true,
        destination_event_key: "Purchase",
        event_type: TrackingEventType.TRACK_EVENT,
        event_name: "purchase",
      },
    ];

    const fieldsMapper = new FieldsMapperMock(() => {
      return {};
    });
    const fieldMapperFactory = new FieldsMapperFactoryMock(() => {
      return fieldsMapper;
    });

    const browser = new BrowserMock();
    const win = { ...window };
    const fbqFunc = jest.fn();
    fbqFunc.mockClear();
    win.fbq = fbqFunc;
    browser.setWindow(win);
    const pixelId = generatePixelId();

    const dependencies: PluginDependencies = {
      sync: {
        id: randomUUID(),
        destination_app: "facebook_pixel",
        settings: [
          {
            key: "pixel_id",
            value: pixelId,
          },
        ],
        field_mappings: [],
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

    const plugin = new FacebookPixel(dependencies);
    expect(plugin).toBeDefined();
    expect(fbqFunc).toHaveBeenCalledTimes(1);

    fbqFunc.mockClear();
    const ctx = new ContextFactoryImpl().newContext({
      type: JournifyEventType.TRACK,
      event: "add_to_cart",
      properties: {
        value: 1000,
        item_id: "123",
      },
    });
    plugin.track(ctx);
    expect(fbqFunc).toHaveBeenCalledTimes(0);
  });

  it("should send a standard page event to facebook pixel when it's mapped and mapping is enabled", () => {
    const facebookEventName = "PageView";
    testSendingEvent(TrackingEventType.PAGE_EVENT, facebookEventName, true);
  });

  it("should send a non-standard page event to facebook pixel when it's mapped and mapping is enabled", () => {
    const facebookEventName = "Custom page view 123";
    testSendingEvent(TrackingEventType.PAGE_EVENT, facebookEventName, false);
  });

  it("should send a page view to facebook if the page matches the filter", () => {
    testPageFiltering(true);
  });

  it("should not send a page view to facebook if the page doesn't match the filter", () => {
    testPageFiltering(false);
  });

  it("should send a standard group event to facebook pixel when it's mapped and mapping is enabled", () => {
    const facebookEventName = "Contact";
    testSendingEvent(TrackingEventType.GROUP_EVENT, facebookEventName, true);
  });

  it("should send a non-standard group event to facebook pixel when it's mapped and mapping is enabled", () => {
    const facebookEventName = "Custom group event 123";
    testSendingEvent(TrackingEventType.GROUP_EVENT, facebookEventName, false);
  });

  it("should not inject the facebook pixel script and log init params when testing mode is enabled", () => {
    const generatedPixelId = generatePixelId();
    const logger = {
      log: jest.fn(),
    };

    const plugin = new FacebookPixel({
      testingWriteKey: true,
      logger: logger,
      sync: {
        id: randomUUID(),
        destination_app: "facebook_pixel",
        settings: [
          {
            key: "pixel_id",
            value: generatedPixelId,
          },
        ],
        field_mappings: [],
        event_mappings: [],
      },
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      eventMapperFactory: new EventMapperFactoryImpl(),
      fieldMapperFactory: new FieldsMapperFactoryImpl(),
      browser: new BrowserMock(),
      sentry: {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      },
    });
    expect(plugin).toBeDefined();

    const expectedFirstLogMessage = `Facebook Pixel ${generatedPixelId} is detected, but script is not injected because you are using a testing write key.`;
    const expectedSecondLogMessage = `Will call window.fbq with the following params in order:`;
    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.log).nthCalledWith(1, expectedFirstLogMessage);
    expect(logger.log).nthCalledWith(2, expectedSecondLogMessage, [
      "init",
      generatedPixelId,
      {},
    ]);
  });

  it("[Standard event] should log the init and identify event when calling identify and testing mode is enabled", () => {
    testLoggingEvent(TrackingEventType.IDENTIFY_EVENT, "ViewContent", true);
  });

  it("[Custom event] should log the init and identify event when calling identify and testing mode is enabled", () => {
    testLoggingEvent(
      TrackingEventType.IDENTIFY_EVENT,
      "Custom Identify event",
      false
    );
  });

  it("[Standard event] should log the track event when calling track and testing mode is enabled", () => {
    testLoggingEvent(
      TrackingEventType.TRACK_EVENT,
      "AddToCart",
      true,
      "add_to_cart"
    );
  });

  it("[Custom event] should log the track event when calling track and testing mode is enabled", () => {
    testLoggingEvent(
      TrackingEventType.TRACK_EVENT,
      "Custom event 0837",
      false,
      "custom_event"
    );
  });

  it("[Standard event] should log the page event when calling page and testing mode is enabled", () => {
    testLoggingEvent(TrackingEventType.PAGE_EVENT, "PageView", true);
  });

  it("[Custom event] should log the page event when calling page and testing mode is enabled", () => {
    testLoggingEvent(TrackingEventType.PAGE_EVENT, "Custom Page View", false);
  });

  it("[Standard event] should log the group event when calling group and testing mode is enabled", () => {
    testLoggingEvent(TrackingEventType.GROUP_EVENT, "Contact", true);
  });

  it("[Custom event] should log the group event when calling group and testing mode is enabled", () => {
    testLoggingEvent(
      TrackingEventType.GROUP_EVENT,
      "Custom Group event 1234",
      false
    );
  });
});

function testInit(
  pixelId: string,
  fbqFunc: jest.Func,
  mapEventFunc: jest.Func,
  user: User,
  eventMappings?: EventMapping[]
): FacebookPixel {
  // mapper mocking
  const fieldsMapper = new FieldsMapperMock(mapEventFunc);
  const fieldsMappings: FieldMapping[] = [
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.email",
      },
      target: { name: "em" },
    },
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.firstname",
      },
      target: { name: "fn" },
    },
  ];
  const fieldsMapperFactoryFunc = jest.fn((mappingsParam: FieldMapping[]) => {
    expect(mappingsParam).toBe(fieldsMappings);
    return fieldsMapper;
  });
  const mapperFactory = new FieldsMapperFactoryMock(fieldsMapperFactoryFunc);

  // browser mocking
  const win = { ...window };
  win.fbq = fbqFunc;
  const browser = new BrowserMock();
  browser.setWindow(win);

  // testing
  const dependencies: PluginDependencies = {
    sync: {
      id: randomUUID(),
      destination_app: "facebook_pixel",
      settings: [
        {
          key: "pixel_id",
          value: pixelId,
        },
      ],
      field_mappings: fieldsMappings,
      event_mappings: eventMappings || [],
    },
    user,
    sentry: {
      setTag: jest.fn(),
      setResponse: jest.fn(),
      captureException: jest.fn(),
      captureMessage: jest.fn(),
    },
    eventMapperFactory: new EventMapperFactoryImpl(),
    fieldMapperFactory: mapperFactory,
    browser: browser,
    testingWriteKey: false,
    logger: console,
  };

  const plugin = new FacebookPixel(dependencies);
  expect(plugin).toBeDefined();
  expect(fieldsMapperFactoryFunc).toHaveBeenCalledTimes(1);

  return plugin;
}

function generatePixelId(): string {
  return Math.floor(Math.random() * 10000000).toString();
}

function testSendingEvent(
  eventType: TrackingEventType,
  facebookEventName: string,
  isStandardEvent: boolean,
  sourceEventName?: string
) {
  // initialize the plugin
  const generatedPixelId = generatePixelId();
  const eventMappings = [
    {
      enabled: true,
      destination_event_key: facebookEventName,
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
      target: { name: "em" },
    },
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.firstname",
      },
      target: { name: "fn" },
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

  const browser = new BrowserMock();
  const win = { ...window };
  const fbqFunc = jest.fn();
  win.fbq = fbqFunc;
  browser.setWindow(win);

  const dependencies: PluginDependencies = {
    sync: {
      id: randomUUID(),
      destination_app: "facebook_pixel",
      settings: [
        {
          key: "pixel_id",
          value: generatedPixelId,
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

  const plugin = new FacebookPixel(dependencies);
  expect(plugin).toBeDefined();

  // initialize the event
  const eventDeduplicationId = randomUUID();
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
      fn: "John",
      em: "example@example.com",
      value: 1000,
      item_id: "123",
      event_id: eventDeduplicationId,
    };
  });
  fieldsMapper.setMapEventFunc(mapEventFunc);

  fbqFunc.mockClear();
  fbqFunc.mockImplementation(
    (
      trackType: string,
      pixelId: string,
      eventName: string,
      properties: object,
      metadata: object
    ) => {
      const expectedTrackType = isStandardEvent
        ? "trackSingle"
        : "trackSingleCustom";
      expect(trackType).toBe(expectedTrackType);
      expect(pixelId).toBe(generatedPixelId);
      expect(eventName).toBe(facebookEventName);
      expect(properties).toEqual({
        value: 1000,
        item_id: "123",
        currency: "USD",
      });
      expect(metadata).toEqual({
        eventID: eventDeduplicationId,
      });
    }
  );

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
  expect(fbqFunc).toHaveBeenCalledTimes(1);
}

function testPageFiltering(matchFilter: boolean) {
  // mock dependencies
  const generatedPixelId = generatePixelId();
  const fieldsMappings: FieldMapping[] = [];
  const eventDeduplicationId = randomUUID();
  const fieldsMapper = new FieldsMapperMock(() => {
    return {};
  });
  const fieldMapperFactory = new FieldsMapperFactoryMock(() => fieldsMapper);
  const browser = new BrowserMock();
  const fbqFunc = jest.fn(
    (method: string, pixelID: string, userData: object) => {
      expect(method).toBe("init");
      expect(pixelID).toBe(generatedPixelId);
      expect(userData).toEqual({});
    }
  );
  const win = { ...window };
  win.fbq = fbqFunc;
  browser.setWindow(win);

  const facebookEventName = "PageView";
  const eventMappings = [
    {
      enabled: true,
      destination_event_key: facebookEventName,
      event_type: TrackingEventType.PAGE_EVENT,
      filters: [
        {
          field: "context.page.path",
          operator: FilterOperator.EQUALS,
          value: "/checkout",
        },
      ],
    },
  ];
  const dependencies: PluginDependencies = {
    sync: {
      id: randomUUID(),
      destination_app: "facebook_pixel",
      settings: [
        {
          key: "pixel_id",
          value: generatedPixelId,
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

  // create the plugin
  const plugin = new FacebookPixel(dependencies);
  expect(plugin).toBeDefined();

  // track the page view
  const ctx = new ContextFactoryImpl().newContext({
    type: JournifyEventType.PAGE,
    context: {
      page: {
        path: matchFilter ? "/checkout" : "/home",
      },
    },
    properties: {
      value: 199993,
      item_id: "123450399",
    },
  });

  expect(fbqFunc).toHaveBeenCalledTimes(1);

  if (matchFilter) {
    fieldsMapper.setMapEventFunc(() => {
      return {
        fn: "John",
        em: "example@example.com",
        value: 199993,
        item_id: "123450399",
        event_id: eventDeduplicationId,
      };
    });

    const fbqFunc = jest.fn(
      (
        trackType: string,
        pixelId: string,
        eventName: string,
        properties: object,
        metadata: object
      ) => {
        expect(trackType).toBe("trackSingle");
        expect(pixelId).toBe(generatedPixelId);
        expect(eventName).toBe(facebookEventName);
        expect(properties).toEqual({
          value: 199993,
          item_id: "123450399",
          currency: "USD",
        });
        expect(metadata).toEqual({
          eventID: eventDeduplicationId,
        });
      }
    );
    win.fbq = fbqFunc;
    plugin.page(ctx);

    expect(fbqFunc).toHaveBeenCalledTimes(1);
  } else {
    plugin.page(ctx);
    expect(fbqFunc).toHaveBeenCalledTimes(1);
  }
}

function testLoggingEvent(
  eventType: TrackingEventType,
  fbEventName: string,
  isStandardEvent: boolean,
  sourceEventName?: string
) {
  const generatedPixelId = generatePixelId();
  const logger = {
    log: jest.fn(),
  };

  const eventMappings = [
    {
      enabled: true,
      destination_event_key: fbEventName,
      event_name: sourceEventName,
      event_type: eventType,
    },
  ];
  const plugin = new FacebookPixel({
    testingWriteKey: true,
    logger: logger,
    sync: {
      id: randomUUID(),
      destination_app: "facebook_pixel",
      settings: [
        {
          key: "pixel_id",
          value: generatedPixelId,
        },
      ],
      field_mappings: [
        {
          source: {
            type: FieldMappingSourceType.FIELD,
            value: "properties.prop1",
          },
          target: {
            name: "facebook_prop1",
          },
        },
        {
          source: {
            type: FieldMappingSourceType.FIELD,
            value: "traits.trait1",
          },
          target: {
            name: "facebook_trait1",
          },
        },
      ],
      event_mappings: eventMappings,
    },
    user: new UserMock(randomUUID(), randomUUID(), {}, {}),
    eventMapperFactory: new EventMapperFactoryImpl(),
    fieldMapperFactory: new FieldsMapperFactoryImpl(),
    browser: new BrowserMock(),
    sentry: {
      setTag: jest.fn(),
      setResponse: jest.fn(),
      captureException: jest.fn(),
      captureMessage: jest.fn(),
    },
  });
  expect(plugin).toBeDefined();
  logger.log.mockClear();

  const expectedEvent = {};

  switch (eventType) {
    case TrackingEventType.TRACK_EVENT:
      plugin.track(
        new ContextFactoryImpl().newContext(
          {
            type: JournifyEventType.TRACK,
            event: sourceEventName,
            properties: {
              prop1: "Prop1 value",
            },
          },
          randomUUID()
        )
      );

      expectedEvent["facebook_prop1"] = "Prop1 value";
      break;

    case TrackingEventType.PAGE_EVENT:
      plugin.page(
        new ContextFactoryImpl().newContext(
          {
            type: JournifyEventType.PAGE,
          },
          randomUUID()
        )
      );
      break;

    case TrackingEventType.IDENTIFY_EVENT:
      plugin.identify(
        new ContextFactoryImpl().newContext(
          {
            type: JournifyEventType.IDENTIFY,
            traits: {
              trait1: "Trait1 value",
            },
          },
          randomUUID()
        )
      );
      expectedEvent["facebook_trait1"] = "Trait1 value";
      break;

    case TrackingEventType.GROUP_EVENT:
      plugin.group(
        new ContextFactoryImpl().newContext(
          {
            type: JournifyEventType.GROUP,
          },
          randomUUID()
        )
      );
      break;
  }

  const expectedLogMessagePrefix = `Will call window.fbq with the following params in order:`;
  const expectInitCall = eventType === TrackingEventType.IDENTIFY_EVENT;
  expect(logger.log).toHaveBeenCalledTimes(expectInitCall ? 2 : 1);
  if (expectInitCall) {
    expect(logger.log).nthCalledWith(1, expectedLogMessagePrefix, [
      "init",
      generatedPixelId,
      { facebook_trait1: "Trait1 value" },
    ]);
  }

  const expectedEventType = isStandardEvent
    ? "trackSingle"
    : "trackSingleCustom";
  expect(logger.log).nthCalledWith(
    expectInitCall ? 2 : 1,
    expectedLogMessagePrefix,
    [
      expectedEventType,
      generatedPixelId,
      fbEventName,
      {
        currency: "USD",
        ...expectedEvent,
      },
      {},
    ]
  );
}
