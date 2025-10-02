/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Sync, Plugin, PluginDependencies, Logger } from "../plugin";
import { User } from "../../../domain/user";
import { Browser } from "../../browser";
import { Context } from "../../context";
import { JournifyEvent, JournifyEventType } from "../../../domain/event";
import { toLowerCase, trim } from "../lib/tranformations";
import { getStoredIdentify } from "../lib/identify";
import { toSettingsObject } from "../lib/settings";
import {FieldsMapper, FieldsMapperFactory} from "../lib/fieldMapping";
import {EventMapper, EventMapperFactory} from "../lib/eventMapping";

const SNAPCHAT_PIXEL_SCRIPT_URL = "https://sc-static.net/scevent.min.js";

declare global {
  interface Window {
    snaptr?: (...args: any[]) => void;
  }
}

type TRACKING_TYPE = "init" | "track";

export class SnapchatPixel implements Plugin {
  public readonly name = "snapchat_pixel";
  private readonly browser: Browser;
  private readonly user: User;
  private readonly fieldMapperFactory: FieldsMapperFactory;
  private readonly eventMapperFactory: EventMapperFactory;
  private readonly testingMode: boolean;
  private readonly logger: Logger;
  private settings: Record<string, string>;
  private fieldsMapper: FieldsMapper;
  private eventMapper: EventMapper;

  public constructor(deps: PluginDependencies) {
    this.user = deps.user;
    this.browser = deps.browser;
    this.eventMapperFactory = deps.eventMapperFactory;
    this.fieldMapperFactory = deps.fieldMapperFactory;
    this.testingMode = deps.testingWriteKey;
    this.logger = deps.logger;
    this.init(deps.sync);
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

  track(ctx: Context): Context {
    return this.trackPixelEvent(ctx);
  }

  group(ctx: Context): Context {
    return this.trackPixelEvent(ctx);
  }

  updateSettings(sync: Sync): void {
    this.init(sync);
  }

  page(ctx: Context): Context {
    return this.trackPixelEvent(ctx);
  }

  private trackPixelEvent(ctx: Context): Context {
    const event = ctx.getEvent();
    const mappedEvent = this.eventMapper.applyEventMapping(event);
    if (!mappedEvent) {
      return ctx;
    }

    const mappedProperties = this.fieldsMapper.mapEvent(event);
    const eventName = mappedEvent?.pixelEventName || event.event;
    const properties = this.transformProperties(mappedProperties);
    this.callPixelHelper("track", eventName, properties);

    return ctx;
  }

  private transformProperties(
    properties: Record<string, any>
  ): Record<string, any> {
    if (properties.item_category) {
      if (properties.item_category instanceof Array) {
        if (properties.item_category.length > 1) {
          properties.item_category = [properties.item_category.join(",")];
        }
        if (properties.item_category.length === 1) {
          properties.item_category = properties.item_category[0];
        }
      }
    }

    if (
      properties.item_ids instanceof Array &&
      properties.item_ids.length > 0
    ) {
      properties.item_ids = [properties.item_ids.join(";")];
    }

    if (
      properties.number_items instanceof Array &&
      properties.number_items.length > 0
    ) {
      properties.number_items = properties.number_items.join(";");
    }

    if (properties.transaction_id) {
      properties.transaction_id = properties.transaction_id.toString();
    }

    return properties;
  }

  private init(sync: Sync) {
    this.eventMapper = this.eventMapperFactory.newEventMapper(
      sync.event_mappings
    );
    this.fieldsMapper = this.fieldMapperFactory.newFieldMapper(
      sync.field_mappings
    );
    this.settings = toSettingsObject(sync.settings);

    if (this.testingMode) {
      this.logger.log(
        `Snapchat Pixel ${this.settings.pixel_id} is detected, but script is not injected because you are using a testing write key.`
      );
    } else {
      this.loadScript();
    }

    const event = getStoredIdentify(this.user);
    this.initPixel(event);
  }
  private initPixel(identifyEvent: JournifyEvent) {
    const userData = this.mapUserData(identifyEvent);
    this.callPixelHelper("init", this.settings.pixel_id, userData);
  }
  private callPixelHelper(trackingType: TRACKING_TYPE, ...args: any[]) {
    if (this.testingMode) {
      this.logger.log(
        "Will call window.snaptr with the following params in order:",
        [trackingType, ...args]
      );
    } else {
      this.browser.window().snaptr(trackingType, ...args);
    }
  }
  private mapUserData(event: JournifyEvent): object {
    const transformationsMap: Record<string, ((val: string) => string)[]> = {
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
    };
    return this.fieldsMapper.mapEvent(event, transformationsMap);
  }

  /* eslint-disable */
  private loadScript() {
    const localWindow = this.browser.window();
    if (localWindow.snaptr) return;

    const a: any = (localWindow.snaptr = function () {
      a.handleRequest
        ? a.handleRequest.apply(a, arguments)
        : a.queue.push(arguments);
    });
    a.queue = [];
    const s = "script";
    const localDocument = this.browser.document();
    const r = localDocument.createElement(s);
    r.async = !0;
    r.src = SNAPCHAT_PIXEL_SCRIPT_URL;
    const u = localDocument.getElementsByTagName(s)[0];
    u.parentNode.insertBefore(r, u);
  }
  /* eslint-enable */
}
