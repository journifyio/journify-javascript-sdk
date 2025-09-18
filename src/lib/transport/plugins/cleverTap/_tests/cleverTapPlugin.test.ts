import { PluginDependencies, Sync } from "../../plugin";
import { randomUUID } from "node:crypto";
import { CleverTapPlugin } from "../cleverTapPlugin";
import { UserMock } from "../../../../../test/mocks/user";
import { ContextFactoryImpl } from "../../../context";
import { JournifyEventType } from "../../../../domain/event";
import { CleverTapWrapper } from "../cleverTapWrapper";

describe("CleverTap plugin", () => {
  it("should init CleverTap SDK with the settings", () => {
    const accountId = "account-ID-12345";
    const region = "us1";
    const settings = [
      { key: "account_id", value: accountId },
      { key: "region", value: region },
    ];
    const sdk: CleverTapWrapper = {
      init: jest.fn(),
      pushProfileData: null,
      pushEvent: null,
    };
    const deps = newBasicDependencies(sdk);
    deps.sync.settings = settings;

    const plugin = new CleverTapPlugin(deps);
    expect(plugin).toBeDefined();
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledWith(accountId, region);
  });

  it("should init CleverTap SDK with an empty region", () => {
    const accountId = "new-account-ID-7393993";
    const region = " ";
    const settings = [
      { key: "account_id", value: accountId },
      { key: "region", value: region },
    ];
    const sdk: CleverTapWrapper = {
      init: jest.fn(),
      pushProfileData: null,
      pushEvent: null,
    };
    const deps = newBasicDependencies(sdk);
    deps.sync.settings = settings;

    new CleverTapPlugin(deps);
    expect(sdk.init).toHaveBeenCalledWith(accountId, "");
  });

  it("should identify the current profile with the right properties", () => {
    const userId = "user-id-123";
    const traits = {
      name: "John Doe",
      email: "john@doe2024.com",
      phone: "+1234567890",
      gender: "male",
      birthday: "1995-03-12T14:46:43.231Z",
      avatar: "https://example.com/photo.jpg",
      additionalTrait: "additional-trait Value 123677",
    };
    const user = new UserMock(userId, randomUUID(), traits, {}, {});
    const pushFn = jest.fn();
    const sdk: CleverTapWrapper = {
      init: jest.fn(),
      pushProfileData: pushFn,
      pushEvent: null,
    };
    const deps = newBasicDependencies(sdk);
    deps.user = user;

    const plugin = new CleverTapPlugin(deps);
    const ctx = new ContextFactoryImpl().newContext({
      type: JournifyEventType.IDENTIFY,
    });
    plugin.identify(ctx);

    expect(pushFn).toHaveBeenCalledWith({
      Site: {
        Name: traits.name,
        Identity: userId,
        Gender: traits.gender.charAt(0).toUpperCase(),
        DOB: traits.birthday,
        Phone: traits.phone,
        Email: traits.email,
        Photo: traits.avatar,
        additionalTrait: traits.additionalTrait,
      },
    });
  });

  it("should call cleverTap init with the new sync settings when updateSettings is called", () => {
    const accountId1 = "account-ID-12345";
    const region1 = "us1";
    const settings1 = [
      { key: "account_id", value: accountId1 },
      { key: "region", value: region1 },
    ];

    const initFn = jest.fn();
    const sdk: CleverTapWrapper = {
      init: initFn,
      pushProfileData: null,
      pushEvent: null,
    };
    const deps = newBasicDependencies(sdk);
    deps.sync.settings = settings1;

    const plugin = new CleverTapPlugin(deps);
    expect(plugin).toBeDefined();
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledWith(accountId1, region1);

    initFn.mockClear();

    const accountId2 = "account-ID-2291839";
    const region2 = "mec1";
    const settings2 = [
      { key: "account_id", value: accountId2 },
      { key: "region", value: region2 },
    ];

    const newSync: Sync = {
      id: randomUUID(),
      destination_app: "cleverTap",
      settings: settings2,
      field_mappings: [],
      event_mappings: [],
    };

    plugin.updateSettings(newSync);
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledWith(accountId2, region2);
  });

  it("should send Web Page Viewed event to CleverTap when page is called", () => {
    const pushFn = jest.fn();
    const sdk: CleverTapWrapper = {
      init: jest.fn(),
      pushEvent: pushFn,
      pushProfileData: null,
    };

    const deps = newBasicDependencies(sdk);
    const plugin = new CleverTapPlugin(deps);
    expect(plugin).toBeDefined();

    const ctx = new ContextFactoryImpl().newContext({
      type: JournifyEventType.PAGE,
      name: "Home",
      context: {
        page: {
          referrer: "https://example.com",
          search: "?q=example",
          title: "Home page",
          path: "/home",
          url: "https://example.com/home?q=example",
        },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      properties: {
        customProperty: "customValue",
        "custom-property-2": "custom-value-2",
        CustomProperty3: "custom-value 3",
      },
    });
    plugin.page(ctx);

    expect(pushFn).toHaveBeenCalledTimes(1);
    expect(pushFn).toHaveBeenCalledWith("Web Page Viewed", {
      Referrer: "https://example.com",
      Search: "?q=example",
      Title: "Home page",
      Path: "/home",
      URL: "https://example.com/home?q=example",
      UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      customProperty: "customValue",
      "custom-property-2": "custom-value-2",
      CustomProperty3: "custom-value 3",
    });
  });

  it("should send a custom event to CleverTap when track is called", () => {
    const pushFn = jest.fn();
    const sdk: CleverTapWrapper = {
      pushEvent: pushFn,
      init: jest.fn(),
      pushProfileData: null,
    };

    const deps = newBasicDependencies(sdk);
    const plugin = new CleverTapPlugin(deps);
    expect(plugin).toBeDefined();

    const event = {
      type: JournifyEventType.TRACK,
      event: "Custom Event",
      properties: {
        prop1: "value 1",
        prop2: "value 2",
        Price: 100.939,
        Amount: 10000,
        checkout: true,
      },
    };

    const ctx = new ContextFactoryImpl().newContext(event);
    plugin.track(ctx);

    expect(pushFn).toHaveBeenCalledTimes(1);
    expect(pushFn).toHaveBeenCalledWith(event.event, event.properties);
  });

  it("should map `Order Completed` event to CleverTap `Charged` event", () => {
    const pushFn = jest.fn();
    const sdk: CleverTapWrapper = {
      pushEvent: pushFn,
      init: jest.fn(),
      pushProfileData: null,
    };

    const deps = newBasicDependencies(sdk);
    const plugin = new CleverTapPlugin(deps);
    expect(plugin).toBeDefined();

    const event = {
      type: JournifyEventType.TRACK,
      event: "Order Completed",
      properties: {
        "Charged ID": "17390KDKE",
        Amount: 10000,
        Items: "item1, item2, item3",
        Checkout: true,
      },
    };

    const ctx = new ContextFactoryImpl().newContext(event);
    plugin.track(ctx);

    expect(pushFn).toHaveBeenCalledTimes(1);
    expect(pushFn).toHaveBeenCalledWith("Charged", event.properties);
  });

  it("should stringify nested objects and arrays for custom attributes before sending them to CleverTap", () => {
    const pushFn = jest.fn();
    const sdk: CleverTapWrapper = {
      pushEvent: pushFn,
      init: jest.fn(),
      pushProfileData: null,
    };

    const deps = newBasicDependencies(sdk);
    const plugin = new CleverTapPlugin(deps);
    expect(plugin).toBeDefined();

    const event = {
      type: JournifyEventType.TRACK,
      event: "add_to_cart",
      properties: {
        prop1: "value 1",
        prop2: "value 2",
        Price: 100.939,
        Amount: 10000,
        checkout: true,
        nestedObjects: {
          "nested-prop-1": "nested-value-1",
          "nested-prop-2": "nested-value-2",
        },
        nestedArray: ["item1", "item2", "item3"],
      },
    };

    const ctx = new ContextFactoryImpl().newContext(event);
    plugin.track(ctx);

    expect(pushFn).toHaveBeenCalledTimes(1);
    expect(pushFn).toHaveBeenCalledWith(event.event, {
      prop1: "value 1",
      prop2: "value 2",
      Price: 100.939,
      Amount: 10000,
      checkout: true,
      nestedObjects: JSON.stringify({
        "nested-prop-1": "nested-value-1",
        "nested-prop-2": "nested-value-2",
      }),
      nestedArray: JSON.stringify(["item1", "item2", "item3"]),
    });
  });
});

function newBasicDependencies(
  sdk: CleverTapWrapper
): PluginDependencies<CleverTapWrapper> {
  return {
    sync: {
      id: randomUUID(),
      destination_app: "cleverTap",
      settings: [],
      field_mappings: [],
      event_mappings: [],
    },
    user: null,
    sentry: {
      setTag: jest.fn(),
      setResponse: jest.fn(),
      captureException: jest.fn(),
      captureMessage: jest.fn(),
    },
    fieldMapperFactory: null,
    eventMapperFactory: null,
    browser: null,
    testingWriteKey: false,
    logger: null,
    externalSDK: sdk,
  };
}
