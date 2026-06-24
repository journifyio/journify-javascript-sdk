/* eslint-disable  @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { RedditPixel } from "../redditPixel";
import {
  EventMapping,
  FieldMapping,
  FieldMappingSourceType,
  PluginDependencies,
  TrackingEventType,
} from "../../plugin";
import { UserMock } from "../../../../../test/mocks/user";
import { BrowserMock } from "../../../../../test/mocks/browser";
import { ContextFactoryImpl } from "../../../context";
import { JournifyEventType } from "../../../../domain/event";
import { FieldsMapperFactoryImpl } from "../../lib/fieldMapping";
import { EventMapperFactoryImpl } from "../../lib/eventMapping";
import { Loader } from "../../../../api/loader";

const REDDIT_PIXEL_SCRIPT_URL =
  "https://www.redditstatic.com/ads/pixel.js?pixel_id=pixel-123";

describe("RedditPixel plugin", () => {
  it("should inject reddit pixel script on the page", () => {
    const browser = new BrowserMock();
    browser.setWindow({ ...window });

    const rdtFunc = jest.fn();
    const injectScriptFunc = jest.fn(() => {
      const w = { ...window };
      w.rdt = rdtFunc as any;
      browser.setWindow(w);
    });
    browser.setInjectScriptFn(injectScriptFunc);

    const plugin = newPlugin({
      browser,
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      fieldMappings: [],
      eventMappings: [],
    });

    expect(plugin).toBeDefined();
    expect(injectScriptFunc).toHaveBeenCalledTimes(1);
    expect(injectScriptFunc).toHaveBeenCalledWith(REDDIT_PIXEL_SCRIPT_URL, {
      async: true,
    });
    expect(rdtFunc).toHaveBeenCalledTimes(1);
    expect(rdtFunc).toHaveBeenCalledWith("init", "pixel-123", {
    });
  });

  it("should preserve reddit sendEvent context after the script loads", () => {
    const browser = new BrowserMock();
    browser.setWindow({ ...window });

    const injectScriptFunc = jest.fn();
    browser.setInjectScriptFn(injectScriptFunc);

    const plugin = newPlugin({
      browser,
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      fieldMappings: [],
      eventMappings: [
        {
          enabled: true,
          destination_event_key: "AddToCart",
          event_type: TrackingEventType.TRACK_EVENT,
          event_name: "add_to_cart",
        },
      ],
    });

    expect(plugin).toBeDefined();

    const localWindow = browser.window() as Window & { rdt?: any };
    const shim = localWindow.rdt;
    const sendEvent = jest.fn(function (this: any, ...args: any[]) {
      expect(this).toBe(shim);
      expect(args).toEqual(["track", "AddToCart", { value: 10 }]);
    });
    shim.sendEvent = sendEvent;

    plugin.track(
      new ContextFactoryImpl().newContext({
        type: JournifyEventType.TRACK,
        event: "add_to_cart",
        properties: { value: 10 },
      })
    );

    expect(sendEvent).toHaveBeenCalledTimes(1);
  });

  it("should not inject script and should log rdt calls on testing write keys", () => {
    const browser = new BrowserMock();
    browser.setWindow({ ...window });
    const injectScriptFn = jest.fn();
    browser.setInjectScriptFn(injectScriptFn);

    const logger = {
      log: jest.fn(),
    };

    const plugin = newPlugin({
      browser,
      logger,
      testingWriteKey: true,
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      fieldMappings: [],
      eventMappings: [],
    });

    expect(plugin).toBeDefined();
    expect(injectScriptFn).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      "Reddit Pixel pixel-123 is detected, but script is not injected because you are using a testing write key."
    );
    expect(logger.log).toHaveBeenCalledWith(
      "Will call window.rdt with the following params in order:",
      ["init", "pixel-123", {}]
    );
  });

  it("should initialize the reddit pixel with identify user data", () => {
    const browser = new BrowserMock();
    const rdtFunc = jest.fn();
    const localWindow = window as Window & { rdt?: any };
    localWindow.rdt = rdtFunc as any;
    browser.setWindow(localWindow);

    const user = new UserMock(
      randomUUID(),
      randomUUID(),
      {
        email: "User@Example.com",
        external_id: "external-user-id",
        phone: "+1 (650) 555-1234",
      },
      {}
    );

    const fieldMappings = identifyFieldMappings();
    const plugin = newPlugin({
      browser,
      user,
      fieldMappings,
      eventMappings: [],
    });

    expect(plugin).toBeDefined();
    expect(rdtFunc).toHaveBeenCalledWith("init", "pixel-123", {
      email: "user@example.com",
      externalId: "external-user-id",
      phoneNumber: "+16505551234",
    });
  });

  it("should track the mapped identify event without re-initializing the pixel", () => {
    const browser = new BrowserMock();
    const rdtFunc = jest.fn();
    const localWindow = window as Window & { rdt?: any };
    localWindow.rdt = rdtFunc as any;
    browser.setWindow(localWindow);

    const user = new UserMock(
      randomUUID(),
      randomUUID(),
      { email: "stored@example.com" },
      {}
    );

    const fieldMappings: FieldMapping[] = [
      ...identifyFieldMappings(),
      {
        source: {
          type: FieldMappingSourceType.FIELD,
          value: "traits.email",
        },
        target: { name: "email" },
      },
      {
        source: {
          type: FieldMappingSourceType.TEMPLATE,
          value:
            "{{ record.properties.client_dedup_id | default: record.messageId }}",
        },
        target: { name: "event_id" },
      },
    ];
    const eventMappings: EventMapping[] = [
      {
        enabled: true,
        destination_event_key: "Lead",
        event_type: TrackingEventType.IDENTIFY_EVENT,
      },
    ];

    const plugin = newPlugin({
      browser,
      user,
      fieldMappings,
      eventMappings,
    });

    rdtFunc.mockClear();
    plugin.identify(
      new ContextFactoryImpl().newContext(
        {
          type: JournifyEventType.IDENTIFY,
          traits: {
            email: "new@example.com",
          },
          properties: {
            client_dedup_id: "dedup-1",
          },
        },
        randomUUID()
      )
    );

    expect(rdtFunc).toHaveBeenCalledTimes(1);
    expect(rdtFunc).toHaveBeenNthCalledWith(1, "track", "Lead", {
      email: "new@example.com",
      conversionId: "dedup-1",
    });
  });

  it("should send page visit when mapped", () => {
    const browser = new BrowserMock();
    const rdtFunc = jest.fn();
    const localWindow = window as Window & { rdt?: any };
    localWindow.rdt = rdtFunc as any;
    browser.setWindow(localWindow);

    const plugin = newPlugin({
      browser,
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      fieldMappings: [
        {
          source: {
            type: FieldMappingSourceType.TEMPLATE,
            value:
              "{{ record.properties.client_dedup_id | default: record.messageId }}",
          },
          target: { name: "event_id" },
        },
      ],
      eventMappings: [
        {
          enabled: true,
          destination_event_key: "PageVisit",
          event_type: TrackingEventType.PAGE_EVENT,
          event_name: "PAGE_EVENT_KEY",
        },
      ],
    });

    rdtFunc.mockClear();
    const ctx = new ContextFactoryImpl().newContext({
      type: JournifyEventType.PAGE,
      event: "PAGE_EVENT_KEY",
      properties: {
        path: "/pricing",
        client_dedup_id: "page-1",
      },
    });

    plugin.page(ctx);
    expect(rdtFunc).toHaveBeenCalledWith("track", "PageVisit", {
      path: "/pricing",
      conversionId: "page-1",
    });
  });

  it("should send a standard reddit event with mapped payload", () => {
    const browser = new BrowserMock();
    const rdtFunc = jest.fn();
    const localWindow = window as Window & { rdt?: any };
    localWindow.rdt = rdtFunc as any;
    browser.setWindow(localWindow);

    const fieldMappings: FieldMapping[] = [
      {
        source: {
          type: FieldMappingSourceType.FIELD,
          value: "properties.value",
        },
        target: { name: "value" },
      },
      {
        source: {
          type: FieldMappingSourceType.FIELD,
          value: "properties.currency",
        },
        target: { name: "currency" },
      },
      {
        source: {
          type: FieldMappingSourceType.FIELD,
          value: "properties.items.$.item_id",
        },
        target: { name: "products.$.id" },
      },
      {
        source: {
          type: FieldMappingSourceType.TEMPLATE,
          value:
            "{{ record.properties.client_dedup_id | default: record.messageId }}",
        },
        target: { name: "event_id" },
      },
    ];
    const eventMappings: EventMapping[] = [
      {
        enabled: true,
        destination_event_key: "Purchase",
        event_type: TrackingEventType.TRACK_EVENT,
        event_name: "purchase",
      },
    ];

    const plugin = newPlugin({
      browser,
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      fieldMappings,
      eventMappings,
    });

    rdtFunc.mockClear();
    const ctx = new ContextFactoryImpl().newContext({
      type: JournifyEventType.TRACK,
      event: "purchase",
      properties: {
        value: 149.99,
        currency: "USD",
        client_dedup_id: "purchase-1",
        items: [{ item_id: "sku-1" }],
      },
    });

    plugin.track(ctx);
    expect(rdtFunc).toHaveBeenCalledWith("track", "Purchase", {
      value: 149.99,
      currency: "USD",
      products: [{ id: "sku-1" }],
      conversionId: "purchase-1",
    });
  });

  it("should send custom reddit events through the Custom channel", () => {
    const browser = new BrowserMock();
    const rdtFunc = jest.fn();
    const localWindow = window as Window & { rdt?: any };
    localWindow.rdt = rdtFunc as any;
    browser.setWindow(localWindow);

    const eventMappings: EventMapping[] = [
      {
        enabled: true,
        destination_event_key: "demo_booked",
        event_type: TrackingEventType.TRACK_EVENT,
        event_name: "book_demo",
      },
    ];

    const plugin = newPlugin({
      browser,
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      fieldMappings: [],
      eventMappings,
    });

    rdtFunc.mockClear();
    const ctx = new ContextFactoryImpl().newContext({
      type: JournifyEventType.TRACK,
      event: "book_demo",
      properties: {
        value: 42,
      },
    });

    plugin.track(ctx);
    expect(rdtFunc).toHaveBeenCalledWith("track", "Custom", {
      value: 42,
      customEventName: "demo_booked",
    });
  });

  it("should use properties.custom_event_name when destination event is Custom", () => {
    const browser = new BrowserMock();
    const rdtFunc = jest.fn();
    const localWindow = window as Window & { rdt?: any };
    localWindow.rdt = rdtFunc as any;
    browser.setWindow(localWindow);

    const fieldMappings: FieldMapping[] = [
      {
        source: {
          type: FieldMappingSourceType.FIELD,
          value: "properties.value",
        },
        target: { name: "value" },
      },
      {
        source: {
          type: FieldMappingSourceType.FIELD,
          value: "properties.custom_event_name",
        },
        target: { name: "custom_event_name" },
      },
    ];
    const eventMappings: EventMapping[] = [
      {
        enabled: true,
        destination_event_key: "Custom",
        event_type: TrackingEventType.TRACK_EVENT,
        event_name: "custom",
      },
    ];

    const plugin = newPlugin({
      browser,
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      fieldMappings,
      eventMappings,
    });

    rdtFunc.mockClear();
    plugin.track(
      new ContextFactoryImpl().newContext({
        type: JournifyEventType.TRACK,
        event: "custom",
        properties: {
          value: 42,
          custom_event_name: "wishlist_added",
        },
      })
    );

    expect(rdtFunc).toHaveBeenCalledWith("track", "Custom", {
      value: 42,
      customEventName: "wishlist_added",
    });
  });

  it("should no-op when destination event is Custom without properties.custom_event_name", () => {
    const browser = new BrowserMock();
    const rdtFunc = jest.fn();
    const localWindow = window as Window & { rdt?: any };
    localWindow.rdt = rdtFunc as any;
    browser.setWindow(localWindow);

    const logger = {
      log: jest.fn(),
    };
    const eventMappings: EventMapping[] = [
      {
        enabled: true,
        destination_event_key: "Custom",
        event_type: TrackingEventType.TRACK_EVENT,
        event_name: "custom",
      },
    ];

    const plugin = newPlugin({
      browser,
      logger,
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      fieldMappings: [],
      eventMappings,
    });

    rdtFunc.mockClear();
    plugin.track(
      new ContextFactoryImpl().newContext({
        type: JournifyEventType.TRACK,
        event: "custom",
        properties: { value: 42 },
      })
    );

    expect(rdtFunc).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      "Reddit Pixel custom events require properties.custom_event_name when destination_event_key is Custom."
    );
  });

  it("should no-op when the event mapping is missing", () => {
    const browser = new BrowserMock();
    const rdtFunc = jest.fn();
    const localWindow = window as Window & { rdt?: any };
    localWindow.rdt = rdtFunc as any;
    browser.setWindow(localWindow);

    const plugin = newPlugin({
      browser,
      user: new UserMock(randomUUID(), randomUUID(), {}, {}),
      fieldMappings: [],
      eventMappings: [],
    });

    rdtFunc.mockClear();
    plugin.track(
      new ContextFactoryImpl().newContext({
        type: JournifyEventType.TRACK,
        event: "unmapped_event",
        properties: { value: 1 },
      })
    );

    expect(rdtFunc).not.toHaveBeenCalled();
  });

  it("should be registered in the loader for reddit_pixel syncs", () => {
    const loader = new Loader({
      setTag: jest.fn(),
      setResponse: jest.fn(),
      captureException: jest.fn(),
      captureMessage: jest.fn(),
    } as any);

    (loader as any).user = new UserMock(randomUUID(), randomUUID(), {}, {});
    (loader as any).sdkSettings = { writeKey: "wk_123" };

    const sharedDeps = (loader as any).createSharedPluginDependencies();
    const plugin = (loader as any).createPlugin(
      {
        id: "sync-id",
        destination_app: "reddit_pixel",
        settings: [{ key: "pixel_id", value: "pixel-123" }],
        field_mappings: [],
        event_mappings: [],
      },
      sharedDeps
    );

    expect(plugin).toBeInstanceOf(RedditPixel);
  });
});

function newPlugin({
  browser,
  user,
  fieldMappings,
  eventMappings,
  testingWriteKey = false,
  logger = console,
}: {
  browser: BrowserMock;
  user: UserMock;
  fieldMappings: FieldMapping[];
  eventMappings: EventMapping[];
  testingWriteKey?: boolean;
  logger?: { log: (...args: any[]) => void };
}): RedditPixel {
  const dependencies: PluginDependencies = {
    sync: {
      id: "sync_id",
      destination_app: "reddit_pixel",
      settings: [
        {
          key: "pixel_id",
          value: "pixel-123",
        },
      ],
      field_mappings: fieldMappings,
      event_mappings: eventMappings,
    },
    user,
    sentry: {
      setTag: jest.fn(),
      setResponse: jest.fn(),
      captureException: jest.fn(),
      captureMessage: jest.fn(),
    },
    fieldMapperFactory: new FieldsMapperFactoryImpl(),
    eventMapperFactory: new EventMapperFactoryImpl(),
    browser,
    testingWriteKey,
    logger,
  };

  return new RedditPixel(dependencies);
}

function identifyFieldMappings(): FieldMapping[] {
  return [
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
        value: "traits.external_id",
      },
      target: { name: "externalId" },
    },
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.phone",
      },
      target: { name: "phoneNumber" },
    },
  ];
}
