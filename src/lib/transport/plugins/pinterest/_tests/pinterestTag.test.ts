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
import { PinterestTag } from "../pinterestTag";
import { JournifyEvent, JournifyEventType } from "../../../../domain/event";
import { Transformation, toLowerCase, trim } from "../../lib/tranformations";
import { User } from "../../../../domain/user";
import { ContextFactoryImpl } from "../../../context";
import { EventMapperFactoryImpl } from "../../lib/mapping";

const SNAPCHAT_PIXEL = "https://s.pinimg.com/ct/core.js";
describe("PinterestTag plugin", () => {
  it("it should inject the pinterest tag script", () => {
    const browser = new BrowserMock();
    const user = new UserMock(randomUUID(), randomUUID(), {}, {});

    const generatedTagId = generateTagId();
    const createdScript = document.createElement("script");
    const reinitializeBrowserWindow = () => {
      const win = { ...window };
      delete win.pintrk;
      browser.setWindow(win);
    };
    const pintrkFunc = jest.fn(
      (method: string, tagId: string, userData: object) => {
        expect(method).toBe("load");
        expect(tagId).toBe(generatedTagId);
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
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      win.pintrk = pintrkFunc;
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
        destination_app: "pinterest_tag",
        settings: [
          {
            key: "tag_id",
            value: generatedTagId,
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

    const plugin = new PinterestTag(dependencies);
    expect(plugin).toBeDefined();

    expect(createElementFunc).toBeCalledTimes(1);
    expect(insertScriptFunc).toBeCalledTimes(1);
    expect(getElementsByTagNameFunc).toBeCalledTimes(1);
    expect(pintrkFunc).toBeCalledTimes(1);
  });

  it("should initialize the pinterest tag with user data", () => {
    const generatedTagId = generateTagId();
    const mappedUserData = {
      em: "Email@Example.com",
    };

    const pintrkFunc = jest.fn(
      (method: string, tagId: string, userData: object) => {
        expect(method).toBe("load");
        expect(tagId).toBe(generatedTagId);
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

        expect(transformationsMap).toEqual({ em: [trim, toLowerCase] });

        return mappedUserData;
      }
    );
    testLoad(generatedTagId, pintrkFunc, mapEventFunc, user);
    expect(pintrkFunc).toBeCalledTimes(1);
    expect(mapEventFunc).toBeCalledTimes(1);
  });

  it("should identify the user on pinterest and ignore the identify event if it's not on the event mappings", () => {
    const generatedTagId = generateTagId();
    const mappedUserData = {
      em: "said@farid.com",
    };
    const pintrkFunc = jest.fn(
      (method: string, tagId: string, userData: object) => {
        expect(method).toBe("load");
        expect(tagId).toBe(generatedTagId);
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

        expect(transformationsMap).toEqual({ em: [trim, toLowerCase] });
        return mappedUserData;
      }
    );

    const plugin = testLoad(generatedTagId, pintrkFunc, mapEventFunc, user);
    expect(pintrkFunc).toBeCalledTimes(1);
    user.setUserId(randomUUID());
    user.setAnonymousId(randomUUID());
    user.setTraits({ email: "said@farid.com" });

    plugin.identify(
      new ContextFactoryImpl().newContext(
        { type: JournifyEventType.IDENTIFY },
        randomUUID()
      )
    );

    expect(mapEventFunc).toBeCalledTimes(2);
    expect(pintrkFunc).toBeCalledTimes(2);
  });

  it("should send the identify event to pinterest tag when it's mapped and mapping is enabled", () => {
    const pinterestEventName = "SIGN_UP";
    const generatedTagId = generateTagId();
    const mappedUserData = {
      em: "hello@world.com",
    };

    const pintrkFunc = jest.fn(
      (method: string, param2: string, param3: object | string) => {
        switch (method) {
          case "load":
            expect(param2).toBe(generatedTagId);
            expect(param3).toEqual(mappedUserData);
            break;
          case "track":
            expect(param2).toBe(pinterestEventName);
            expect(param3).toEqual({
              em: "hello@world.com",
            });
            break;
        }
      }
    );

    const user = new UserMock(randomUUID(), randomUUID(), {}, {});

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
          });
        }

        return mappedUserData;
      }
    );

    const plugin = testLoad(generatedTagId, pintrkFunc, mapEventFunc, user, [
      {
        enabled: true,
        destination_event_key: pinterestEventName,
        event_type: TrackingEventType.IDENTIFY_EVENT,
      },
    ]);
    expect(pintrkFunc).toBeCalledTimes(1);

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
    expect(pintrkFunc).toBeCalledTimes(3);
  });

  it("should send a standard track event to pinterest tag when it's mapped and mapping is enabled", () => {
    const sourceEventName = "sign_up";
    const pinterestEventName = "signup";
    testSendingEvent(
      TrackingEventType.TRACK_EVENT,
      pinterestEventName,
      sourceEventName
    );
  });

  it("should send a non-standard track event to pinterest tag when it's mapped and mapping is enabled", () => {
    const sourceEventName = "add_to_cart";
    const pinterestEventName = "Custom event 123";
    testSendingEvent(
      TrackingEventType.TRACK_EVENT,
      pinterestEventName,
      sourceEventName
    );
  });
});

function testSendingEvent(
  eventType: TrackingEventType,
  pinterestEventName: string,
  sourceEventName?: string
) {
  // initialize the plugin
  const generatedTagId = generateTagId();
  const fieldsMappings: FieldMapping[] = [
    {
      source: {
        type: FieldMappingSourceType.FIELD,
        value: "traits.email",
      },
      target: { name: "em" },
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
  const pintrkFunc = jest.fn();
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  win.pintrk = pintrkFunc;
  browser.setWindow(win);

  const eventMappings = [
    {
      enabled: true,
      destination_event_key: pinterestEventName,
      event_type: eventType,
      event_name: sourceEventName,
    },
  ];
  const dependencies: PluginDependencies = {
    sync: {
      id: randomUUID(),
      destination_app: "pinterest_tag",
      settings: [
        {
          key: "tag_id",
          value: generatedTagId,
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

  const plugin = new PinterestTag(dependencies);
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
      value: 1000,
      item_id: "123",
    };
  });
  fieldsMapper.setMapEventFunc(mapEventFunc);

  pintrkFunc.mockClear();
  pintrkFunc.mockImplementation(
    (trackType: string, eventName: string, properties: object) => {
      const expectedTrackType = "track";
      expect(trackType).toBe(expectedTrackType);
      expect(eventName).toBe(pinterestEventName);
      expect(properties).toEqual({
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
  expect(pintrkFunc).toBeCalledTimes(1);
}

function testLoad(
  tagId: string,
  pintrkFunc: jest.Func,
  mapEventFunc: jest.Func,
  user: User,
  eventMappings?: EventMapping[]
): PinterestTag {
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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  win.pintrk = pintrkFunc;
  const browser = new BrowserMock();
  browser.setWindow(win);

  // testing
  const dependencies: PluginDependencies = {
    sync: {
      id: randomUUID(),
      destination_app: "pinterest_tag",
      settings: [
        {
          key: "tag_id",
          value: tagId,
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

  const plugin = new PinterestTag(dependencies);
  expect(plugin).toBeDefined();
  expect(fieldsMapperFactoryFunc).toBeCalledTimes(1);

  return plugin;
}
function generateTagId(): string {
  return Math.floor(Math.random() * 10000000).toString();
}
