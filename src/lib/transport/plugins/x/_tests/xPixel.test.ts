/* eslint-disable  @typescript-eslint/no-explicit-any */

import { randomUUID } from "crypto";
import { BrowserMock } from "../../../../../test/mocks/browser";
import {
  FieldsMapperFactoryMock,
  FieldsMapperMock,
} from "../../../../../test/mocks/mapping";
import { UserMock } from "../../../../../test/mocks/user";
import {
  FieldMapping,
  FieldMappingSourceType,
  PluginDependencies,
  TrackingEventType,
} from "../../plugin";
import { XPixel } from "../xPixel";
import { JournifyEvent, JournifyEventType } from "../../../../domain/event";
import { ContextFactoryImpl } from "../../../context";
import { EventMapperFactoryImpl } from "../../lib/mapping";

const X_PIXEL_SRC_URL = "https://static.ads-twitter.com/uwt.js";
describe("X plugin", () => {
  it("it should inject the x pixel script", () => {
    const browser = new BrowserMock();
    const user = new UserMock(randomUUID(), randomUUID(), {}, {});

    const generatedPixelId = generatePixelId();
    const createdScript = document.createElement("script");
    const reinitializeBrowserWindow = () => {
      const win = { ...window };
      delete win.twq;
      browser.setWindow(win);
    };
    const twqFunc = jest.fn((method: string, pixelId: string) => {
      expect(method).toBe("config");
      expect(pixelId).toBe(generatedPixelId);
    });
    const createElementFunc = jest.fn((tagName: string) => {
      expect(tagName).toBe("script");
      return createdScript;
    });

    const insertScriptFunc = jest.fn((node: any, child: any): any => {
      expect(node["src"]).toEqual(X_PIXEL_SRC_URL);
      expect(node).toBe(createdScript);
      expect(child).toBe(firstScript);

      const win = { ...window };
      win.twq = twqFunc;
      browser.setWindow(win);
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
        destination_app: "x_pixel",
        settings: [
          {
            key: "x_pixel_id",
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
      browser: browser,
      testingWriteKey: false,
      logger: console,
    };

    reinitializeBrowserWindow();

    const plugin = new XPixel(dependencies);
    expect(plugin).toBeDefined();

    expect(createElementFunc).toBeCalledTimes(1);
    expect(insertScriptFunc).toBeCalledTimes(1);
    expect(getElementsByTagNameFunc).toBeCalledTimes(1);
    expect(twqFunc).toBeCalledTimes(1);
  });

  it("should send a track event to x pixel when it's mapped and mapping is enabled", () => {
    const sourceEventName = "sign_up";
    const xEventName = "oh16t7pd";

    // initialize the plugin
    const generatedPixelId = generatePixelId();
    const fieldsMappings: FieldMapping[] = [
      {
        source: {
          type: FieldMappingSourceType.FIELD,
          value: "properties.value",
        },
        target: { name: "value" },
      },
      {
        source: {
          type: FieldMappingSourceType.TEMPLATE,
          value:
            "{{ record.properties.client_dedup_id | default: record.messageId }}",
        },
        target: { name: "conversion_id" },
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
    const twqFunc = jest.fn();
    win.twq = twqFunc;
    browser.setWindow(win);

    const eventMappings = [
      {
        enabled: true,
        destination_event_key: xEventName,
        event_type: TrackingEventType.TRACK_EVENT,
        event_name: sourceEventName,
      },
    ];
    const dependencies: PluginDependencies = {
      sync: {
        id: randomUUID(),
        destination_app: "x_pixel",
        settings: [
          {
            key: "x_pixel_id",
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

    const plugin = new XPixel(dependencies);
    expect(plugin).toBeDefined();

    // initialize the event
    const ctx = new ContextFactoryImpl().newContext({
      type: TrackingEventType.TRACK_EVENT.toString() as JournifyEventType,
      event: sourceEventName,
      properties: {
        value: 10000.22,
        client_dedup_id: "439847239847FHKHKJHKDFHKJ",
      },
    });

    const mapEventFunc = jest.fn((eventParam: JournifyEvent) => {
      expect(eventParam).toBe(ctx.getEvent());
      return {
        value: 10000.22,
        conversion_id: "439847239847FHKHKJHKDFHKJ",
      };
    });
    fieldsMapper.setMapEventFunc(mapEventFunc);

    twqFunc.mockClear();
    twqFunc.mockImplementation(
      (trackType: string, eventName: string, properties: object) => {
        const expectedTrackType = "event";
        expect(trackType).toBe(expectedTrackType);
        expect(eventName).toBe(`tw-${generatedPixelId}-${xEventName}`);
        expect(properties).toEqual({
          value: 10000.22,
          conversion_id: "439847239847FHKHKJHKDFHKJ",
        });
      }
    );
    // track the event
    plugin.track(ctx);

    // assertions
    expect(mapEventFunc).toBeCalledTimes(1);
    expect(twqFunc).toBeCalledTimes(1);
  });
});

function generatePixelId(): string {
  return Math.floor(Math.random() * 10000000).toString();
}
