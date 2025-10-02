import { UserMock } from "../../../../../test/mocks/user";
import { BrowserMock } from "../../../../../test/mocks/browser";
import {
  FieldMappingSourceType,
  PluginDependencies,
  TrackingEventType,
} from "../../plugin";
import {FieldsMapperFactoryImpl} from "../../lib/fieldMapping";
import {EventMapperFactoryImpl} from "../../lib/eventMapping";
import {
  FieldsMapperFactoryMock,
  FieldsMapperMock,
} from "../../../../../test/mocks/mapping";
import { LinkedinAdsInsightTag } from "../linkedinAdsInsightTag";
import { ContextFactoryImpl } from "../../../context";
import { JournifyEventType } from "../../../../domain/event";

describe("Linkedin Insight Tag", () => {
  it("should inject Linkedin Insight Tag script on the page with the right partner ID", () => {
    const partnerId = "1782829";
    const injectScriptFunc = jest.fn();
    const browser = new BrowserMock();
    browser.setWindow({ ...window });
    browser.setInjectScriptFn(injectScriptFunc);

    const dependencies: PluginDependencies = {
      sync: {
        id: "sync_id_123",
        destination_app: "linkedin_ads_insight_tag",
        settings: [
          {
            key: "linkedin_partner_id",
            value: partnerId,
          },
        ],
        field_mappings: [],
        event_mappings: [],
      },
      user: new UserMock("user_id", "account_id", {}, {}),
      sentry: {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      },
      eventMapperFactory: new EventMapperFactoryImpl(),
      fieldMapperFactory: new FieldsMapperFactoryMock(
        () => new FieldsMapperMock(() => ({}))
      ),
      browser: browser,
      testingWriteKey: false,
      logger: console,
    };

    const plugin = new LinkedinAdsInsightTag(dependencies);

    expect(plugin).toBeDefined();
    expect(injectScriptFunc).toHaveBeenCalledTimes(1);
    expect(injectScriptFunc).toHaveBeenCalledWith(
      "https://snap.licdn.com/li.lms-analytics/insight.min.js",
      { async: true }
    );

    const windowObj = browser.window();
    expect(windowObj._linkedin_data_partner_ids).toContain(partnerId);
    expect(windowObj.lintrk).toBeDefined();
  });

  it("should set email user data on identify", async () => {
    const browser = new BrowserMock();

    const injectScriptFunc = jest.fn();
    browser.setInjectScriptFn(injectScriptFunc);

    const windowObj = { ...window };
    const lintrkMock = jest.fn();
    windowObj.lintrk = lintrkMock;
    browser.setWindow(windowObj);

    const dependencies: PluginDependencies = {
      sync: {
        id: "sync_id_124",
        destination_app: "linkedin_ads_insight_tag",
        settings: [
          {
            key: "linkedin_partner_id",
            value: "1782830",
          },
        ],
        field_mappings: [
          {
            source: {
              type: FieldMappingSourceType.FIELD,
              value: "traits.email",
            },
            target: {
              name: "email",
            },
          },
        ],
        event_mappings: [
          {
            event_type: TrackingEventType.TRACK_EVENT,
            event_name: "purchase",
            destination_event_key: "12345",
            filters: [],
            enabled: true,
          },
        ],
      },
      user: new UserMock("user_id", "account_id", {}, {}),
      sentry: {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      },
      eventMapperFactory: new EventMapperFactoryImpl(),
      fieldMapperFactory: new FieldsMapperFactoryImpl(),
      browser: browser,
      testingWriteKey: false,
      logger: console,
    };

    const plugin = new LinkedinAdsInsightTag(dependencies);

    const ctx = new ContextFactoryImpl().newContext({
      type: "identify" as JournifyEventType,
      traits: {
        email: "email@linkedin.com"
      }
    });

    lintrkMock.mockClear();
    await plugin.identify(ctx);

    expect(lintrkMock).toHaveBeenCalledTimes(1);
    expect(lintrkMock).toHaveBeenCalledWith("setUserData", {
      email: "email@linkedin.com",
    });
  });

  it("should send a conversion to Linkedin with the right conversion ID", async () => {
    const browser = new BrowserMock();

    const injectScriptFunc = jest.fn();
    browser.setInjectScriptFn(injectScriptFunc);

    const windowObj = { ...window };
    const lintrkMock = jest.fn();
    windowObj.lintrk = lintrkMock;
    browser.setWindow(windowObj);

    const conversionId = "1930238";
    const dependencies: PluginDependencies = {
      sync: {
        id: "sync_id_124",
        destination_app: "linkedin_ads_insight_tag",
        settings: [
          {
            key: "linkedin_partner_id",
            value: "1782830",
          },
        ],
        field_mappings: [
          {
            source: {
              type: FieldMappingSourceType.TEMPLATE,
              value:
                "{{ record.properties.client_dedup_id | default: record.messageId }}",
            },
            target: {
              name: "event_id",
            },
          },
          {
            source: {
              type: FieldMappingSourceType.FIELD,
              value: "traits.email",
            },
            target: {
              name: "email",
            },
          },
        ],
        event_mappings: [
          {
            event_type: TrackingEventType.TRACK_EVENT,
            event_name: "purchase",
            destination_event_key: conversionId,
            filters: [],
            enabled: true,
          },
        ],
      },
      user: new UserMock("user_id", "account_id", {email: "john@doe.com"}, {}),
      sentry: {
        setTag: jest.fn(),
        setResponse: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
      },
      eventMapperFactory: new EventMapperFactoryImpl(),
      fieldMapperFactory: new FieldsMapperFactoryImpl(),
      browser: browser,
      testingWriteKey: false,
      logger: console,
    };

    const plugin = new LinkedinAdsInsightTag(dependencies);

    const ctx = new ContextFactoryImpl().newContext({
      type: "track" as JournifyEventType,
      event: "purchase",
      properties: {
        value: 1000,
        item_id: "123",
        client_dedup_id: "abc123",
      },
    });

    lintrkMock.mockClear();
    await plugin.track(ctx);

    expect(lintrkMock).toHaveBeenCalledTimes(2);
    expect(lintrkMock).toHaveBeenNthCalledWith(1, "setUserData", {email: "john@doe.com"});
    expect(lintrkMock).toHaveBeenNthCalledWith(2, "track", {
      conversion_id: 1930238,
      event_id: "abc123",
    });
  });
});
