/* eslint-disable  @typescript-eslint/no-explicit-any */
import { BrowserMock } from "../../../../../test/mocks/browser";
import { UserMock } from "../../../../../test/mocks/user";
import {
  FieldsMapperFactoryMock,
  FieldsMapperMock,
} from "../../../../../test/mocks/mapping";
import {
  EventMapping,
  FieldMapping,
  FieldMappingSourceType,
  PluginDependencies,
  TrackingEventType,
} from "../../plugin";
import { TikTokPixel } from "../tiktokPixel";
import { randomUUID } from "node:crypto";
import { User } from "../../../../domain/user";
import { Context, ContextFactoryImpl } from "../../../context";
import { JournifyEventType } from "../../../../domain/event";
import { EventMapperFactoryImpl } from "../../lib/eventMapping";

const TIKTOK_SCRIPT_URL = "https://analytics.tiktok.com/i18n/pixel/events.js";

describe("TiktokPixel plugin", () => {
  it("should inject tiktok pixel script on the page", () => {
    // case of browser with one script tag
    const browser = new BrowserMock();
    const user = new UserMock(
      randomUUID(),
      randomUUID(),
      { firstname: "John" },
      {}
    );
    const generatedPixelId = generatePixelId();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    browser.setWindow({
      ...window,
      TiktokAnalyticsObject: "ttq",
    });
    const createElementFunc = jest.fn((tagName: string) => {
      expect(tagName).toBe("script");
      return createdScript;
    });

    const insertScriptFunc = jest.fn((node: any, child: any): any => {
      expect(node["src"]).toContain(TIKTOK_SCRIPT_URL);
      expect(node).toBe(createdScript);
      expect(child).toBe(firstScript);
      return child;
    });

    const getElementsByTagNameFunc = jest.fn((tagName: string): any => {
      expect(tagName).toBe("script");
      return [firstScript];
    });

    const firstScript = {
      ...document.createElement("script"),
      parentNode: {
        ...document.createElement("script").parentNode,
        insertBefore: insertScriptFunc,
      },
    };
    const createdScript = document.createElement("script");

    const documentWithScript: Document = {
      ...document,
      createElement: createElementFunc,
      getElementsByTagName: getElementsByTagNameFunc,
    };
    browser.setDocument(documentWithScript);

    const fieldMapper = new FieldsMapperMock(() => {
      return {};
    });

    const dependencies: PluginDependencies = {
      sync: {
        id: "sync_id",
        destination_app: "tiktok_pixel",
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
      fieldMapperFactory: new FieldsMapperFactoryMock(() => fieldMapper),
      eventMapperFactory: new EventMapperFactoryImpl(),
      testingWriteKey: false,
      browser: browser,
      logger: console,
    };

    const plugin = new TikTokPixel(dependencies);
    expect(plugin).toBeDefined();

    expect(createElementFunc).toBeCalledTimes(1);
    expect(insertScriptFunc).toBeCalledTimes(1);
    expect(getElementsByTagNameFunc).toBeCalledTimes(1);
  });

  it("should call Page event when it's mapped", () => {
    const generatedPixelId = generatePixelId();
    const user = new UserMock(
      randomUUID(),
      randomUUID(),
      { firstname: "John" },
      {}
    );
    const plugin = newPlugin(generatedPixelId, user);
    expect(plugin).toBeDefined();

    const ctx = newEvent(TrackingEventType.PAGE_EVENT, "page", {
      url: "http://example.com",
    });

    const spy = jest.spyOn(plugin, "page");

    testSendingEvent(plugin, ctx);

    expect(spy).toHaveBeenCalledWith(ctx);
  });
});

function newPlugin(
  pixelId: string,
  user: User,
  eventMappings?: EventMapping[],
  browser?: BrowserMock
): TikTokPixel {
  browser = browser || new BrowserMock();
  const fieldMapper = new FieldsMapperMock(() => {
    return {};
  });
  const fieldsMappings: FieldMapping[] = [
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.email",
      },
      target: {
        name: "email",
      },
    },
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.phone",
      },
      target: {
        name: "phone_number",
      },
    },
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.external_id",
      },
      target: {
        name: "external_id",
      },
    },
  ];

  const createElementFunc = jest.fn((tagName: string) => {
    expect(tagName).toBe("script");
    return createdScript;
  });

  const insertScriptFunc = jest.fn((node: any, child: any): any => {
    expect(node["src"]).toContain(TIKTOK_SCRIPT_URL);
    expect(node).toBe(createdScript);
    expect(child).toBe(firstScript);
    return child;
  });

  const getElementsByTagNameFunc = jest.fn((tagName: string): any => {
    expect(tagName).toBe("script");
    return [firstScript];
  });

  const firstScript = {
    ...document.createElement("script"),
    parentNode: {
      ...document.createElement("script").parentNode,
      insertBefore: insertScriptFunc,
    },
  };
  const createdScript = document.createElement("script");

  const documentWithScript: Document = {
    ...document,
    ...browser.document,
    createElement: createElementFunc,
    getElementsByTagName: getElementsByTagNameFunc,
  };
  browser.setDocument(documentWithScript);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  browser.setWindow({
    ...window,
    ...browser.window,
    TiktokAnalyticsObject: "ttq",
  });

  const fieldsMapperFactoryFunc = jest.fn((mappingsParam: FieldMapping[]) => {
    expect(mappingsParam).toBe(fieldsMappings);
    return fieldMapper;
  });
  const mapperFactory = new FieldsMapperFactoryMock(fieldsMapperFactoryFunc);
  const dependencies: PluginDependencies = {
    sync: {
      id: "sync_id",
      destination_app: "tiktok_pixel",
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
    fieldMapperFactory: mapperFactory,
    eventMapperFactory: new EventMapperFactoryImpl(),
    testingWriteKey: false,
    browser: browser,
    logger: console,
  };
  const plugin = new TikTokPixel(dependencies);
  expect(plugin).toBeDefined();
  expect(fieldsMapperFactoryFunc).toBeCalledTimes(1);

  return plugin;
}

function newEvent(
  eventType: TrackingEventType,
  sourceEventName: string,
  properties: any
): Context {
  const ctx = new ContextFactoryImpl().newContext({
    type: eventType.toString() as JournifyEventType,
    event: sourceEventName,
    properties,
  });
  return ctx;
}
function testSendingEvent(plugin: TikTokPixel, event: Context) {
  // track the event
  switch (event.getEvent().type.toString() as TrackingEventType) {
    case TrackingEventType.TRACK_EVENT:
      plugin.track(event);
      break;
    case TrackingEventType.PAGE_EVENT:
      plugin.page(event);
      break;
    case TrackingEventType.IDENTIFY_EVENT:
      plugin.identify(event);
      break;
    case TrackingEventType.GROUP_EVENT:
      plugin.group(event);
      break;

    default:
      throw new Error("Invalid event type");
  }
}
function generatePixelId(): string {
  return Math.floor(Math.random() * 10000000).toString();
}
