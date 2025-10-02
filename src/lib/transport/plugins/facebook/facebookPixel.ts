/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Sync, Plugin, PluginDependencies, Logger } from "../plugin";
import { Context } from "../../context";
import { FieldsMapper } from "../lib/fieldMapping";
import { EventMapper } from "../lib/eventMapping";
import {
  facebookBirthday,
  oneLetterGender,
  toDigitsOnlyPhone,
  toLowerCase,
  trim,
} from "../lib/tranformations";
import { JournifyEvent, JournifyEventType } from "../../../domain/event";
import { User } from "../../../domain/user";
import { Browser } from "../../browser";
import { toSettingsObject } from "../lib/settings";
import { getStoredIdentify } from "../lib/identify";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: (...args: any[]) => void;
  }
}

const STANDARD_EVENTS = new Set<string>([
  "AddPaymentInfo",
  "AddToCart",
  "AddToWishlist",
  "CompleteRegistration",
  "Contact",
  "CustomizeProduct",
  "Donate",
  "FindLocation",
  "InitiateCheckout",
  "Lead",
  "Purchase",
  "PageView",
  "Schedule",
  "Search",
  "StartTrial",
  "SubmitApplication",
  "Subscribe",
  "ViewContent",
]);
const USER_DATA_FIELDS = new Set<string>([
  "em",
  "fn",
  "ln",
  "ph",
  "external_id",
  "ge",
  "db",
  "ct",
  "st",
  "zp",
  "country",
]);
const FACEBOOK_SCRIPT_URL = "https://connect.facebook.net/en_US/fbevents.js";
const DEFAULT_CURRENCY = "USD";

export class FacebookPixel implements Plugin {
  public readonly name = "facebook";
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

  track(ctx: Context): Context {
    return this.trackPixelEvent(ctx);
  }

  page(ctx: Context): Context {
    return this.trackPixelEvent(ctx);
  }

  group(ctx: Context): Context {
    return this.trackPixelEvent(ctx);
  }

  identify(ctx: Context): Context {
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

    this.initPixel(event);
    return this.trackPixelEvent(ctx);
  }

  updateSettings(sync: Sync) {
    this.init(sync);
  }

  private trackPixelEvent(ctx: Context): Context {
    const event = ctx.getEvent();
    const mappedEvent = this.eventMapper.applyEventMapping(event);
    if (!mappedEvent) {
      return ctx;
    }

    const mappedProperties = this.fieldsMapper.mapEvent(event);
    const eventId = mappedProperties.event_id;
    delete mappedProperties.event_id;

    const eventName = mappedEvent?.pixelEventName || event.event;
    const trackType = isStandardEvent(eventName)
      ? "trackSingle"
      : "trackSingleCustom";

    const properties = this.removeUserData(mappedProperties);
    if (!properties.currency) {
      properties.currency = DEFAULT_CURRENCY;
    }

    this.callPixelHelper(
      trackType,
      this.settings.pixel_id,
      eventName,
      properties,
      { eventID: eventId }
    );

    return ctx;
  }

  private removeUserData(properties: object): Record<string, any> {
    const output = {};
    for (const key in properties) {
      if (USER_DATA_FIELDS.has(key)) {
        continue;
      }

      output[key] = properties[key];
    }

    return output;
  }

  private init(sync: Sync) {
    this.settings = toSettingsObject(sync.settings);
    if (this.testingMode) {
      this.logger.log(
        `Facebook Pixel ${this.settings.pixel_id} is detected, but script is not injected because you are using a testing write key.`
      );
    } else {
      this.loadFbScript();
    }

    const event = getStoredIdentify(this.user);
    this.initPixel(event);
  }

  private loadFbScript(): void {
    const localWindow = this.browser.window();
    if (localWindow.fbq) {
      return;
    }

    let n = null;
    n = localWindow.fbq = function (...args) {
      n.callMethod ? n.callMethod(...args) : n.queue.push(args);
    };

    if (!localWindow._fbq) localWindow._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];

    this.browser.injectScript(FACEBOOK_SCRIPT_URL, { async: true });
  }

  private initPixel(identifyEvent: JournifyEvent) {
    const userData = this.mapUserData(identifyEvent);
    this.callPixelHelper("init", this.settings.pixel_id, userData);
  }

  private callPixelHelper(...args: any[]) {
    if (this.testingMode) {
      this.logger.log(
        "Will call window.fbq with the following params in order:",
        args
      );
      return;
    }

    this.browser.window().fbq(...args);
  }

  private mapUserData(event: JournifyEvent): object {
    const transformationsMap: Record<string, ((val: string) => string)[]> = {
      em: [trim, toLowerCase],
      fn: [trim, toLowerCase],
      ln: [trim, toLowerCase],
      ph: [toDigitsOnlyPhone],
      city: [trim, toLowerCase],
      st: [trim, toLowerCase],
      country: [toLowerCase],
      ge: [oneLetterGender, toLowerCase],
      db: [facebookBirthday],
    };
    return this.fieldsMapper.mapEvent(event, transformationsMap);
  }
}

function isStandardEvent(eventName: string): boolean {
  return STANDARD_EVENTS.has(eventName);
}
