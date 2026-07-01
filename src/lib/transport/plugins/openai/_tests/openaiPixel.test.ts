/* eslint-disable  @typescript-eslint/no-explicit-any */
import { OpenAIPixel } from "../openaiPixel";
import {
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
import { randomUUID } from "node:crypto";
import { ContextFactoryImpl } from "../../../context";
import { FieldsMapperFactoryImpl } from "../../lib/fieldMapping";
import { EventMapperFactoryImpl } from "../../lib/eventMapping";

const OPENAI_SCRIPT_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js";

describe("OpenAIPixel plugin", () => {
  it("should inject openai pixel script on the page", () => {
    const browser = new BrowserMock();
    browser.setWindow({ ...window });

    const oaiqFunc = jest.fn();
    const injectScriptFunc = jest.fn(() => {
      const w = { ...window };
      w.oaiq = oaiqFunc;
      browser.setWindow(w);
    });
    browser.setInjectScriptFn(injectScriptFunc);

    const user = new UserMock(randomUUID(), randomUUID(), {}, {});
    const generatedPixelId = generatePixelId();
    const fieldMapper = new FieldsMapperMock(() => ({}));
    const dependencies: PluginDependencies = {
      sync: {
        id: "sync_id",
        destination_app: "openai_pixel",
        settings: [{ key: "pixel_id", value: generatedPixelId }],
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
      browser,
      testingWriteKey: false,
      logger: console,
    };
    const plugin = new OpenAIPixel(dependencies);

    expect(plugin).toBeDefined();
    expect(injectScriptFunc).toHaveBeenCalledTimes(1);
    expect(injectScriptFunc).toHaveBeenCalledWith(OPENAI_SCRIPT_URL, {
      async: true,
    });
    expect(oaiqFunc).toHaveBeenCalledTimes(1);
    expect(oaiqFunc).toHaveBeenCalledWith("init", { pixelId: generatedPixelId });
  });

  it("should not re-inject script if oaiq already exists on window", () => {
    const browser = new BrowserMock();
    const oaiqFunc = jest.fn();
    const win = { ...window };
    win.oaiq = oaiqFunc;
    browser.setWindow(win);

    const injectScriptFunc = jest.fn();
    browser.setInjectScriptFn(injectScriptFunc);

    const generatedPixelId = generatePixelId();
    const fieldMapper = new FieldsMapperMock(() => ({}));
    const dependencies: PluginDependencies = {
      sync: {
        id: "sync_id",
        destination_app: "openai_pixel",
        settings: [{ key: "pixel_id", value: generatedPixelId }],
        field_mappings: [],
        event_mappings: [],
      },
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      sentry: {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      },
      eventMapperFactory: new EventMapperFactoryImpl(),
      fieldMapperFactory: new FieldsMapperFactoryMock(() => fieldMapper),
      browser,
      testingWriteKey: false,
      logger: console,
    };

    new OpenAIPixel(dependencies);
    expect(injectScriptFunc).toHaveBeenCalledTimes(0);
  });

  it("should not inject the openai pixel script and log init params when testing mode is enabled", () => {
    const generatedPixelId = generatePixelId();
    const logger = { log: jest.fn() };

    const plugin = new OpenAIPixel({
      testingWriteKey: true,
      logger,
      sync: {
        id: randomUUID(),
        destination_app: "openai_pixel",
        settings: [{ key: "pixel_id", value: generatedPixelId }],
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

    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.log).nthCalledWith(
      1,
      `OpenAI Pixel ${generatedPixelId} is detected, but script is not injected because you are using a testing write key.`
    );
    expect(logger.log).nthCalledWith(
      2,
      "Will call window.oaiq with the following params in order:",
      ["init", { pixelId: generatedPixelId }]
    );
  });

  it("should send a standard track event to openai pixel when mapped", () => {
    testSendingEvent(
      TrackingEventType.TRACK_EVENT,
      "order_created",
      "contents",
      "purchase"
    );
  });

  it("should send a custom track event to openai pixel when mapped", () => {
    testSendingEvent(
      TrackingEventType.TRACK_EVENT,
      "custom",
      "custom",
      "custom_track"
    );
  });

  it("should send a standard page event to openai pixel when mapped", () => {
    testSendingEvent(TrackingEventType.PAGE_EVENT, "page_viewed", "contents");
  });

  it("should send a custom page event to openai pixel when mapped", () => {
    testSendingEvent(TrackingEventType.PAGE_EVENT, "custom", "custom");
  });

  it("should send a standard group event to openai pixel when mapped", () => {
    testSendingEvent(
      TrackingEventType.GROUP_EVENT,
      "lead_created",
      "customer_action"
    );
  });

  it("should send a custom group event to openai pixel when mapped", () => {
    testSendingEvent(TrackingEventType.GROUP_EVENT, "custom", "custom");
  });

  it("should send a plan enrollment type for subscription events", () => {
    testSendingEvent(
      TrackingEventType.TRACK_EVENT,
      "subscription_created",
      "plan_enrollment",
      "subscribe"
    );
  });

  it("should not send a track event to openai pixel when it is not mapped", () => {
    const eventMappings = [
      {
        enabled: true,
        destination_event_key: "order_created",
        event_type: TrackingEventType.TRACK_EVENT,
        event_name: "purchase",
      },
    ];

    const fieldsMapper = new FieldsMapperMock(() => ({}));
    const fieldMapperFactory = new FieldsMapperFactoryMock(() => fieldsMapper);

    const browser = new BrowserMock();
    const win = { ...window };
    const oaiqFunc = jest.fn();
    win.oaiq = oaiqFunc;
    browser.setWindow(win);
    const pixelId = generatePixelId();

    const dependencies: PluginDependencies = {
      sync: {
        id: randomUUID(),
        destination_app: "openai_pixel",
        settings: [{ key: "pixel_id", value: pixelId }],
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
      fieldMapperFactory,
      browser,
      testingWriteKey: false,
      logger: console,
    };

    const plugin = new OpenAIPixel(dependencies);
    expect(plugin).toBeDefined();
    expect(oaiqFunc).toHaveBeenCalledTimes(1); // init only

    oaiqFunc.mockClear();
    const ctx = new ContextFactoryImpl().newContext({
      type: JournifyEventType.TRACK,
      event: "add_to_cart",
      properties: { value: 100 },
    });
    plugin.track(ctx);
    expect(oaiqFunc).toHaveBeenCalledTimes(0);
  });

  it("should identify the user and call init on identify", () => {
    const generatedPixelId = generatePixelId();
    const oaiqFunc = jest.fn();

    const user = new UserMock(
      randomUUID(),
      randomUUID(),
      { email: "test@example.com" },
      {}
    );

    const browser = new BrowserMock();
    const win = { ...window };
    win.oaiq = oaiqFunc;
    browser.setWindow(win);

    const fieldMapper = new FieldsMapperMock(() => ({}));
    const dependencies: PluginDependencies = {
      sync: {
        id: randomUUID(),
        destination_app: "openai_pixel",
        settings: [{ key: "pixel_id", value: generatedPixelId }],
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
      browser,
      testingWriteKey: false,
      logger: console,
    };

    const plugin = new OpenAIPixel(dependencies);
    expect(oaiqFunc).toHaveBeenCalledTimes(1); // init on construction

    oaiqFunc.mockClear();
    plugin.identify(
      new ContextFactoryImpl().newContext(
        { type: JournifyEventType.IDENTIFY },
        randomUUID()
      )
    );
    // identify calls initPixel again (re-init with updated user data)
    expect(oaiqFunc).toHaveBeenCalledWith("init", {
      pixelId: generatedPixelId,
    });
  });

  it("should include only country city and zip_code in the init user payload", () => {
    const generatedPixelId = generatePixelId();
    const browser = new BrowserMock();
    const oaiqFunc = jest.fn();
    const win = { ...window };
    win.oaiq = oaiqFunc;
    browser.setWindow(win);

    const plugin = new OpenAIPixel({
      sync: {
        id: randomUUID(),
        destination_app: "openai_pixel",
        settings: [{ key: "pixel_id", value: generatedPixelId }],
        field_mappings: [
          {
            source: { type: 1, value: "traits.country_code" },
            target: { name: "country" },
          },
          {
            source: { type: 1, value: "traits.city" },
            target: { name: "city" },
          },
          {
            source: { type: 1, value: "traits.postal_code" },
            target: { name: "zip_code" },
          },
        ],
        event_mappings: [],
      },
      user: new UserMock(
        randomUUID(),
        randomUUID(),
        {
          country_code: " us ",
          city: " San Francisco ",
          postal_code: "94107",
          email: "test@example.com",
        },
        {}
      ),
      sentry: {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      },
      eventMapperFactory: new EventMapperFactoryImpl(),
      fieldMapperFactory: new FieldsMapperFactoryImpl(),
      browser,
      testingWriteKey: false,
      logger: console,
    });

    expect(plugin).toBeDefined();
    expect(oaiqFunc).toHaveBeenCalledWith("init", {
      pixelId: generatedPixelId,
      user: {
        country: "US",
        city: "San Francisco",
        zip_code: "94107",
      },
    });
  });

  it("should send a page view when page matches the filter", () => {
    testPageFiltering(true);
  });

  it("should not send a page view when page does not match the filter", () => {
    testPageFiltering(false);
  });

  it("[Standard event] should log the track event in testing mode", () => {
    testLoggingEvent(
      TrackingEventType.TRACK_EVENT,
      "order_created",
      "contents",
      "purchase"
    );
  });

  it("[Custom event] should log the track event in testing mode", () => {
    testLoggingEvent(
      TrackingEventType.TRACK_EVENT,
      "custom",
      "custom",
      "custom_track"
    );
  });

  it("[Standard event] should log the page event in testing mode", () => {
    testLoggingEvent(TrackingEventType.PAGE_EVENT, "page_viewed", "contents");
  });

  it("[Custom event] should log the page event in testing mode", () => {
    testLoggingEvent(TrackingEventType.PAGE_EVENT, "custom", "custom");
  });

  it("should omit null event_id from event options", () => {
    const generatedPixelId = generatePixelId();
    const fieldsMapper = new FieldsMapperMock(() => ({}));
    const fieldMapperFactory = new FieldsMapperFactoryMock(() => fieldsMapper);
    const browser = new BrowserMock();
    const win = { ...window };
    const oaiqFunc = jest.fn();
    win.oaiq = oaiqFunc;
    browser.setWindow(win);

    const plugin = new OpenAIPixel({
      sync: {
        id: randomUUID(),
        destination_app: "openai_pixel",
        settings: [{ key: "pixel_id", value: generatedPixelId }],
        field_mappings: [],
        event_mappings: [
          {
            enabled: true,
            destination_event_key: "order_created",
            event_type: TrackingEventType.TRACK_EVENT,
            event_name: "purchase",
          },
        ],
      },
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      sentry: {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      },
      eventMapperFactory: new EventMapperFactoryImpl(),
      fieldMapperFactory,
      browser,
      testingWriteKey: false,
      logger: console,
    });

    fieldsMapper.setMapEventFunc(() => ({ value: 1000, event_id: null }));
    oaiqFunc.mockClear();

    plugin.track(
      new ContextFactoryImpl().newContext({
        type: JournifyEventType.TRACK,
        event: "purchase",
        properties: { value: 1000 },
      })
    );

    expect(oaiqFunc).toHaveBeenCalledWith(
      "measure",
      "order_created",
      { value: 1000, type: "contents" },
      {}
    );
  });
});

function generatePixelId(): string {
  return Math.floor(Math.random() * 10000000).toString();
}

function testSendingEvent(
  eventType: TrackingEventType,
  openaiEventName: string,
  expectedType: string,
  sourceEventName?: string
) {
  const generatedPixelId = generatePixelId();
  const eventMappings = [
    {
      enabled: true,
      destination_event_key: openaiEventName,
      event_type: eventType,
      event_name: sourceEventName,
    },
  ];
  const fieldsMapper = new FieldsMapperMock(() => ({}));
  const fieldMapperFactory = new FieldsMapperFactoryMock(() => fieldsMapper);

  const browser = new BrowserMock();
  const win = { ...window };
  const oaiqFunc = jest.fn();
  win.oaiq = oaiqFunc;
  browser.setWindow(win);

  const dependencies: PluginDependencies = {
    sync: {
      id: randomUUID(),
      destination_app: "openai_pixel",
      settings: [{ key: "pixel_id", value: generatedPixelId }],
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
    fieldMapperFactory,
    browser,
    testingWriteKey: false,
    logger: console,
  };

  const plugin = new OpenAIPixel(dependencies);
  expect(plugin).toBeDefined();

  const eventDeduplicationId = randomUUID();
  const ctx = new ContextFactoryImpl().newContext({
    type: eventType.toString() as JournifyEventType,
    event: sourceEventName,
    properties: { value: 1000 },
  });

  const mapEventFunc = jest.fn((eventParam: JournifyEvent) => {
    expect(eventParam).toBe(ctx.getEvent());
    if (expectedType === "custom") {
      return {
        value: 1000,
        event_id: eventDeduplicationId,
        custom_event_name: sourceEventName || "custom_event_name",
      };
    }

    return { value: 1000, event_id: eventDeduplicationId };
  });
  fieldsMapper.setMapEventFunc(mapEventFunc);

  oaiqFunc.mockClear();
  oaiqFunc.mockImplementation(
    (
      method: string,
      arg1: string | object,
      arg2?: object,
      arg3?: object
    ) => {
      expect(method).toBe("measure");
      if (expectedType !== "custom") {
        expect(arg1).toBe(openaiEventName);
        expect(arg2).toEqual({ value: 1000, type: expectedType });
        expect(arg3).toEqual({ event_id: eventDeduplicationId });
      } else {
        expect(arg1).toBe("custom");
        expect(arg2).toEqual({ value: 1000, type: "custom" });
        expect(arg3).toEqual({
          custom_event_name: sourceEventName || "custom_event_name",
          event_id: eventDeduplicationId,
        });
      }
    }
  );

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

  expect(mapEventFunc).toHaveBeenCalledTimes(1);
  expect(oaiqFunc).toHaveBeenCalledTimes(1);
}

function testPageFiltering(matchFilter: boolean) {
  const generatedPixelId = generatePixelId();
  const fieldsMapper = new FieldsMapperMock(() => ({}));
  const fieldMapperFactory = new FieldsMapperFactoryMock(() => fieldsMapper);
  const browser = new BrowserMock();
  const oaiqFunc = jest.fn();
  const win = { ...window };
  win.oaiq = oaiqFunc;
  browser.setWindow(win);

  const openaiEventName = "page_viewed";
  const eventMappings = [
    {
      enabled: true,
      destination_event_key: openaiEventName,
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
      destination_app: "openai_pixel",
      settings: [{ key: "pixel_id", value: generatedPixelId }],
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
    fieldMapperFactory,
    browser,
    testingWriteKey: false,
    logger: console,
  };

  const plugin = new OpenAIPixel(dependencies);
  expect(plugin).toBeDefined();
  expect(oaiqFunc).toHaveBeenCalledTimes(1); // init only

  const ctx = new ContextFactoryImpl().newContext({
    type: JournifyEventType.PAGE,
    context: {
      page: { path: matchFilter ? "/checkout" : "/home" },
    },
    properties: { value: 100 },
  });

  oaiqFunc.mockClear();
  plugin.page(ctx);

  if (matchFilter) {
    expect(oaiqFunc).toHaveBeenCalledTimes(1);
    expect(oaiqFunc).toHaveBeenCalledWith(
      "measure",
      openaiEventName,
      expect.any(Object),
      expect.any(Object)
    );
  } else {
    expect(oaiqFunc).toHaveBeenCalledTimes(0);
  }
}

function testLoggingEvent(
  eventType: TrackingEventType,
  openaiEventName: string,
  expectedType: string,
  sourceEventName?: string
) {
  const generatedPixelId = generatePixelId();
  const logger = { log: jest.fn() };

  const eventMappings = [
    {
      enabled: true,
      destination_event_key: openaiEventName,
      event_name: sourceEventName,
      event_type: eventType,
    },
  ];

  const plugin = new OpenAIPixel({
    testingWriteKey: true,
    logger,
    sync: {
      id: randomUUID(),
      destination_app: "openai_pixel",
      settings: [{ key: "pixel_id", value: generatedPixelId }],
      field_mappings: [],
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

  switch (eventType) {
    case TrackingEventType.TRACK_EVENT:
      plugin.track(
        new ContextFactoryImpl().newContext(
          { type: JournifyEventType.TRACK, event: sourceEventName },
          randomUUID()
        )
      );
      break;
    case TrackingEventType.PAGE_EVENT:
      plugin.page(
        new ContextFactoryImpl().newContext(
          { type: JournifyEventType.PAGE },
          randomUUID()
        )
      );
      break;
    case TrackingEventType.IDENTIFY_EVENT:
      plugin.identify(
        new ContextFactoryImpl().newContext(
          { type: JournifyEventType.IDENTIFY },
          randomUUID()
        )
      );
      break;
    case TrackingEventType.GROUP_EVENT:
      plugin.group(
        new ContextFactoryImpl().newContext(
          { type: JournifyEventType.GROUP },
          randomUUID()
        )
      );
      break;
  }

  const logPrefix = "Will call window.oaiq with the following params in order:";
  const expectInitCall = eventType === TrackingEventType.IDENTIFY_EVENT;
  expect(logger.log).toHaveBeenCalledTimes(expectInitCall ? 2 : 1);

  if (expectInitCall) {
    expect(logger.log).nthCalledWith(1, logPrefix, [
      "init",
      { pixelId: generatedPixelId },
    ]);
  }

  if (expectedType !== "custom") {
    expect(logger.log).nthCalledWith(expectInitCall ? 2 : 1, logPrefix, [
      "measure",
      openaiEventName,
      { type: expectedType },
      {},
    ]);
  } else {
    expect(logger.log).nthCalledWith(expectInitCall ? 2 : 1, logPrefix, [
      "measure",
      "custom",
      { type: "custom" },
      { custom_event_name: sourceEventName || "custom" },
    ]);
  }
}
