/* eslint-disable  @typescript-eslint/no-explicit-any */

import { randomUUID } from "crypto";
import { BrowserMock } from "../../../../../test/mocks/browser";
import {
  FieldsMapperFactoryMock,
  FieldsMapperMock,
} from "../../../../../test/mocks/mapping";
import { UserMock } from "../../../../../test/mocks/user";
import {
  EventMapping,
  FieldMapping,
  FieldMappingSourceType,
  PluginDependencies,
  TrackingEventType,
} from "../../plugin";
import { SnapchatPixel } from "../snapchatPixel";
import { JournifyEvent, JournifyEventType } from "../../../../domain/event";
import { Transformation, toLowerCase, trim } from "../../lib/tranformations";
import { User } from "../../../../domain/user";
import { ContextFactoryImpl } from "../../../context";
import { EventMapperFactoryImpl } from "../../lib/eventMapping";

const SNAPCHAT_PIXEL = "https://sc-static.net/scevent.min.js";
describe("SnapchatPixel plugin", () => {
  it("it should inject the snapchat pixel script", () => {
    const browser = new BrowserMock();
    const user = new UserMock(randomUUID(), randomUUID(), {}, {});

    const generatedPixelId = generatePixelId();
    const createdScript = document.createElement("script");
    const reinitializeBrowserWindow = () => {
      const win = { ...window };
      delete win.snaptr;
      browser.setWindow(win);
    };
    const snaptrFunc = jest.fn(
      (method: string, pixelId: string, userData: object) => {
        expect(method).toBe("init");
        expect(pixelId).toBe(generatedPixelId);
        expect(userData).toEqual({});
      }
    );
    const createElementFunc = jest.fn((tagName: string) => {
      expect(tagName).toBe("script");
      return createdScript;
    });

    const insertScriptFunc = jest.fn((node: any, child: any): any => {
      expect(node["src"]).toEqual(SNAPCHAT_PIXEL);
      expect(node).toBe(createdScript);
      expect(child).toBe(firstScript);

      const win = { ...window };
      win.snaptr = snaptrFunc;
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
        destination_app: "snapchat_pixel",
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
      browser: browser,
      testingWriteKey: false,
      logger: console,
    };

    reinitializeBrowserWindow();

    const plugin = new SnapchatPixel(dependencies);
    expect(plugin).toBeDefined();

    expect(createElementFunc).toBeCalledTimes(1);
    expect(insertScriptFunc).toBeCalledTimes(1);
    expect(getElementsByTagNameFunc).toBeCalledTimes(1);
    expect(snaptrFunc).toBeCalledTimes(1);
  });

  it("should initialize the snapchat pixel with user data", () => {
    const generatedPixelId = generatePixelId();
    const mappedUserData = {
      user_email: "Email@Example.com",
      user_phone_number: "1234567890",
      ip_address: "1.1.1.1",
    };

    const snaptrFunc = jest.fn(
      (method: string, pixelId: string, userData: object) => {
        expect(method).toBe("init");
        expect(pixelId).toBe(generatedPixelId);
        expect(userData).toEqual(mappedUserData);
      }
    );

    const user = new UserMock(randomUUID(), randomUUID(), mappedUserData, {});

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
          user_email: [trim, toLowerCase],
          ip_address: [trim, toLowerCase],
          user_hashed_email: [trim, toLowerCase],
          user_hashed_phone_number: [trim, toLowerCase],
          firstname: [trim, toLowerCase],
          lastname: [trim, toLowerCase],
          geo_city: [trim, toLowerCase],
          geo_region: [trim, toLowerCase],
          geo_postal_code: [trim, toLowerCase],
          geo_country: [trim, toLowerCase],
          age: [trim],
        });

        return mappedUserData;
      }
    );
    testInit(generatedPixelId, snaptrFunc, mapEventFunc, user);
    expect(snaptrFunc).toBeCalledTimes(1);
    expect(mapEventFunc).toBeCalledTimes(1);
  });

  it("should identify the user on snapchat and ignore the identify event if it's not on the event mappings", () => {
    const generatedPixelId = generatePixelId();
    const mappedUserData = {
      firstname: "John",
      lastname: "Doe",
    };
    const snaptrFunc = jest.fn(
      (method: string, pixelId: string, userData: object) => {
        expect(method).toBe("init");
        expect(pixelId).toBe(generatedPixelId);
        expect(userData).toEqual(mappedUserData);
      }
    );
    const user = new UserMock(randomUUID(), randomUUID(), {}, {});
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
          user_email: [trim, toLowerCase],
          ip_address: [trim, toLowerCase],
          user_hashed_email: [trim, toLowerCase],
          user_hashed_phone_number: [trim, toLowerCase],
          firstname: [trim, toLowerCase],
          lastname: [trim, toLowerCase],
          geo_city: [trim, toLowerCase],
          geo_region: [trim, toLowerCase],
          geo_postal_code: [trim, toLowerCase],
          geo_country: [trim, toLowerCase],
          age: [trim],
        });

        return mappedUserData;
      }
    );

    const plugin = testInit(generatedPixelId, snaptrFunc, mapEventFunc, user);
    expect(snaptrFunc).toBeCalledTimes(1);
    user.setUserId(randomUUID());
    user.setAnonymousId(randomUUID());
    user.setTraits({ lastname: "Doe" });

    plugin.identify(
      new ContextFactoryImpl().newContext(
        { type: JournifyEventType.IDENTIFY },
        randomUUID()
      )
    );

    expect(mapEventFunc).toBeCalledTimes(2);
    expect(snaptrFunc).toBeCalledTimes(2);
  });

  it("should send the identify event to snapchat pixel when it's mapped and mapping is enabled", () => {
    const snapchatEventName = "SIGN_UP";
    const generatedPixelId = generatePixelId();
    const mappedUserData = {
      state: "NY",
    };

    const snaptrFunc = jest.fn(
      (method: string, param2: string, param3: object | string) => {
        switch (method) {
          case "init":
            expect(param2).toBe(generatedPixelId);
            expect(param3).toEqual(mappedUserData);
            break;
          case "track":
            expect(param2).toBe(snapchatEventName);
            expect(param3).toEqual({
              state: "NY",
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
            user_email: [trim, toLowerCase],
            ip_address: [trim, toLowerCase],
            user_hashed_email: [trim, toLowerCase],
            user_hashed_phone_number: [trim, toLowerCase],
            firstname: [trim, toLowerCase],
            lastname: [trim, toLowerCase],
            geo_city: [trim, toLowerCase],
            geo_region: [trim, toLowerCase],
            geo_postal_code: [trim, toLowerCase],
            geo_country: [trim, toLowerCase],
            age: [trim],
          });
        }

        return mappedUserData;
      }
    );

    const plugin = testInit(generatedPixelId, snaptrFunc, mapEventFunc, user, [
      {
        enabled: true,
        destination_event_key: snapchatEventName,
        event_type: TrackingEventType.IDENTIFY_EVENT,
      },
    ]);
    expect(snaptrFunc).toBeCalledTimes(1);

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

    expect(mapEventFunc).toBeCalledTimes(3);
    expect(snaptrFunc).toBeCalledTimes(3);
  });

  it("should send a standard track event to snapchat pixel when it's mapped and mapping is enabled", () => {
    const sourceEventName = "sign_up";
    const snapchatEventName = "SIGN_UP";
    testSendingEvent(
      TrackingEventType.TRACK_EVENT,
      snapchatEventName,
      sourceEventName
    );
  });

  it("should send a non-standard track event to snapchat pixel when it's mapped and mapping is enabled", () => {
    const sourceEventName = "add_to_cart";
    const snapchatEventName = "Custom event 123";
    testSendingEvent(
      TrackingEventType.TRACK_EVENT,
      snapchatEventName,
      sourceEventName
    );
  });
});

function testSendingEvent(
  eventType: TrackingEventType,
  snapchatEventName: string,
  sourceEventName?: string
) {
  // initialize the plugin
  const generatedPixelId = generatePixelId();
  const fieldsMappings: FieldMapping[] = [
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.email",
      },
      target: { name: "user_email" },
    },
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.firstname",
      },
      target: { name: "firstname" },
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
  const snaptrFunc = jest.fn();
  win.snaptr = snaptrFunc;
  browser.setWindow(win);

  const eventMappings = [
    {
      enabled: true,
      destination_event_key: snapchatEventName,
      event_type: eventType,
      event_name: sourceEventName,
    },
  ];
  const dependencies: PluginDependencies = {
    sync: {
      id: randomUUID(),
      destination_app: "snapchat_pixel",
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

  const plugin = new SnapchatPixel(dependencies);
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
      firstname: "John",
      user_email: "example@example.com",
      value: 1000,
      item_id: "123",
    };
  });
  fieldsMapper.setMapEventFunc(mapEventFunc);

  snaptrFunc.mockClear();
  snaptrFunc.mockImplementation(
    (trackType: string, eventName: string, properties: object) => {
      const expectedTrackType = "track";
      expect(trackType).toBe(expectedTrackType);
      expect(eventName).toBe(snapchatEventName);
      expect(properties).toEqual({
        firstname: "John",
        user_email: "example@example.com",
        value: 1000,
        item_id: "123",
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
  expect(mapEventFunc).toBeCalledTimes(1);
  expect(snaptrFunc).toBeCalledTimes(1);
}

function testInit(
  pixelId: string,
  snaptrFunc: jest.Func,
  mapEventFunc: jest.Func,
  user: User,
  eventMappings?: EventMapping[]
): SnapchatPixel {
  // mapper mocking
  const fieldsMapper = new FieldsMapperMock(mapEventFunc);
  const fieldsMappings: FieldMapping[] = [
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.email",
      },
      target: { name: "user_email" },
    },
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.firstname",
      },
      target: { name: "firstname" },
    },
  ];
  const fieldsMapperFactoryFunc = jest.fn((mappingsParam: FieldMapping[]) => {
    expect(mappingsParam).toBe(fieldsMappings);
    return fieldsMapper;
  });
  const mapperFactory = new FieldsMapperFactoryMock(fieldsMapperFactoryFunc);

  // browser mocking
  const win = { ...window };
  win.snaptr = snaptrFunc;
  const browser = new BrowserMock();
  browser.setWindow(win);

  // testing
  const dependencies: PluginDependencies = {
    sync: {
      id: randomUUID(),
      destination_app: "snapchat_pixel",
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

  const plugin = new SnapchatPixel(dependencies);
  expect(plugin).toBeDefined();
  expect(fieldsMapperFactoryFunc).toBeCalledTimes(1);

  return plugin;
}
function generatePixelId(): string {
  return Math.floor(Math.random() * 10000000).toString();
}
