/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Logger, Plugin, PluginDependencies, Sync } from "../plugin";
import { User } from "../../../domain/user";
import { Browser } from "../../browser";
import { EventMapper, FieldsMapper } from "../lib/mapping";
import { toSettingsObject } from "../lib/settings";
import { getStoredIdentify } from "../lib/identify";
import { JournifyEvent, JournifyEventType } from "../../../domain/event";
import { toLowerCase, trim } from "../lib/tranformations";
import { Context } from "../../context";
import { matchFilters } from "../lib/filters";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export class GoogleAdsGtag implements Plugin {
  public readonly name: string = "google_ads_gtag";
  private settings: Record<string, string> = {};
  private readonly user: User;
  private readonly browser: Browser;
  private readonly fieldsMapper: FieldsMapper;
  private readonly eventMapper: EventMapper;
  private readonly testingMode: boolean;
  private readonly logger: Logger;

  public constructor(deps: PluginDependencies) {
    this.user = deps.user;
    this.browser = deps.browser;
    this.fieldsMapper = deps.fieldMapperFactory.newFieldMapper(
      deps.sync.field_mappings
    );
    this.testingMode = deps.testingWriteKey;
    this.eventMapper = deps.eventMapperFactory.newEventMapper(
      deps.sync.event_mappings
    );
    this.logger = deps.logger;
    this.init(deps.sync);
  }

  track(ctx: Context): Promise<Context> | Context {
    return this.trackGtagEvent(ctx);
  }

  page(ctx: Context): Promise<Context> | Context {
    return this.trackGtagEvent(ctx);
  }

  group(ctx: Context): Promise<Context> | Context {
    return this.trackGtagEvent(ctx);
  }

  identify(ctx: Context): Promise<Context> | Context {
    const newEvent = ctx.getEvent();
    const storedEvent = getStoredIdentify(this.user);

    const event = {
      type: JournifyEventType.IDENTIFY,
      userId: newEvent.userId || storedEvent.userId,
      anonymousId: newEvent.anonymousId || storedEvent.anonymousId,
      traits: {
        ...(storedEvent.traits || {}),
        ...(newEvent.traits || {}),
      },
    };

    this.initTag(event);
    return this.trackGtagEvent(ctx);
  }

  updateSettings(sync: Sync): void {
    this.init(sync);
  }

  private trackGtagEvent(ctx: Context): Promise<Context> | Context {
    const event = ctx.getEvent();
    const eventMapping = this.eventMapper.getEventMapping(event);
    if (!eventMapping || !matchFilters(event, eventMapping?.filters)) {
      return ctx;
    }
    const { conversionID, conversionType } = this.parseMappedEventName(
      eventMapping.pixelEventName
    );
    const mappedProperties = this.fieldsMapper.mapEvent(event);
    delete mappedProperties.conversionAction;
    const properties = this.removeUserInitData(mappedProperties);

    if (event.traits && Object.keys(event.traits).length > 0) {
      const storedIdentify = getStoredIdentify(this.user);
      const identifyEvent = {
        type: JournifyEventType.IDENTIFY,
        userId: event.userId || storedIdentify.userId,
        anonymousId: event.anonymousId || storedIdentify.anonymousId,
        traits: {
          ...(storedIdentify.traits || {}),
          ...(event.traits || {}),
        },
      };
      this.setUserData(identifyEvent);
    }

    switch (conversionType) {
      case "UPLOAD_CALLS":
        this.gtag("config", conversionID, properties);
        break;
      default:
        delete properties.phone_conversion_number;
        this.gtag("event", "conversion", {
          send_to: conversionID,
          ...properties,
        });
        break;
    }

    return ctx;
  }

  private parseMappedEventName(mappedEvent: string): {
    conversionID: string;
    conversionType: string;
  } {
    const split = mappedEvent.split("/");
    const conversionID = split.slice(0, split.length - 1).join("/");
    const conversionType = split[split.length - 1];
    return { conversionID, conversionType };
  }

  private init(sync: Sync) {
    this.settings = toSettingsObject(sync.settings);
    if (this.testingMode) {
      this.logger.log(
        `Google Ads gtag ${this.settings.google_ads_gtag_id} is detected, but script is not injected because you are using a testing write key.`
      );
    } else {
      this.loadGtagScript();
    }

    const event = getStoredIdentify(this.user);
    this.initTag(event);
  }

  private loadGtagScript() {
    const localWindow = this.browser.window();
    localWindow.dataLayer = localWindow.dataLayer || [];
    localWindow.gtag = function () {
      /* eslint-disable prefer-rest-params */
      localWindow.dataLayer.push(arguments);
    };

    const scriptURL = `https://www.googletagmanager.com/gtag/js?id=${this.settings.google_ads_gtag_id}`;
    if (!this.browser.scriptAlreadyInPage(scriptURL)) {
      this.browser.injectScript(scriptURL, { async: true });
    }
  }

  private initTag(identifyEvent: JournifyEvent) {
    this.setUserData(identifyEvent);
    this.gtag("js", new Date());
    this.gtag("config", this.settings.google_ads_gtag_id);
  }

  private setUserData(identifyEvent: JournifyEvent) {
    const userData = this.mapUserData(identifyEvent);
    if (Object.keys(userData).length > 0) {
      this.gtag("set", "user_data", userData);
    }
  }

  private mapUserData(event: JournifyEvent): object {
    const transformationsMap: Record<string, ((val: string) => string)[]> = {
      sha256_email_address: [trim, toLowerCase],
      sha256_phone_number: [trim, toLowerCase],
      "address.sha256_first_name": [trim, toLowerCase],
      "address.sha256_last_name": [trim, toLowerCase],
    };
    return this.fieldsMapper.mapEvent(event, transformationsMap);
  }

  private gtag(...args: any[]) {
    if (this.testingMode) {
      this.logger.log(
        "Will call window.gtag with the following params in order:",
        args
      );
      return;
    }

    this.browser.window().gtag(...args);
  }

  // remove the fields that should only be sent on gtag("set") call from properties
  private removeUserInitData(properties: object): Record<string, any> {
    const output = {};
    for (const key in properties) {
      if (USER_DATA_INIT_FIELDS.has(key)) {
        continue;
      }

      output[key] = properties[key];
    }

    return output;
  }
}

// the fields that should only be sent on gtag("set") call
const USER_DATA_INIT_FIELDS = new Set<string>([
  "email",
  "phone_number",
  "address",
  "sha256_email_address",
  "sha256_phone_number",
]);
