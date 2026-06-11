/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Logger, Plugin, PluginDependencies, Sync } from "../plugin";
import { Context } from "../../context";
import { toSettingsObject } from "../lib/settings";
import { getStoredIdentify } from "../lib/identify";
import { Browser } from "../../browser";
import { User } from "../../../domain/user";
import { JournifyEvent, JournifyEventType } from "../../../domain/event";
import { toE164, toLowerCase, trim } from "../lib/tranformations";
import { FieldsMapper, FieldsMapperFactory } from "../lib/fieldMapping";
import { EventMapper, EventMapperFactory } from "../lib/eventMapping";

declare global {
  interface Window {
    rdt?: {
      (...args: any[]): void;
      sendEvent?: (...args: any[]) => void;
      callQueue?: any[];
    };
  }
}

type RedditPixelQueue = {
  (...args: any[]): void;
  sendEvent?: (...args: any[]) => void;
  callQueue: any[];
};

const REDDIT_PIXEL_SCRIPT_URL = "https://www.redditstatic.com/ads/pixel.js";
const STANDARD_EVENTS = new Set<string>([
  "PageVisit",
  "ViewContent",
  "Search",
  "AddToCart",
  "AddToWishlist",
  "Purchase",
  "Lead",
  "SignUp",
]);

export class RedditPixel implements Plugin {
  public readonly name = "reddit_pixel";
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

    this.initPixel(event);
    return this.trackPixelEvent(ctx);
  }

  page(ctx: Context): Promise<Context> | Context {
    return this.trackPixelEvent(ctx);
  }

  track(ctx: Context): Promise<Context> | Context {
    return this.trackPixelEvent(ctx);
  }

  group(ctx: Context): Promise<Context> | Context {
    return this.trackPixelEvent(ctx);
  }

  updateSettings(sync: Sync): void {
    this.init(sync);
  }

  private init(sync: Sync) {
    this.fieldsMapper = this.fieldMapperFactory.newFieldMapper(
      sync.field_mappings
    );
    this.eventMapper = this.eventMapperFactory.newEventMapper(
      sync.event_mappings
    );
    this.settings = toSettingsObject(sync.settings);

    if (this.testingMode) {
      this.logger.log(
        `Reddit Pixel ${this.settings.pixel_id} is detected, but script is not injected because you are using a testing write key.`
      );
    } else {
      this.loadScript();
    }

    const event = getStoredIdentify(this.user);
    this.initPixel(event);
  }

  private loadScript() {
    const localWindow = this.browser.window();
    if (localWindow.rdt) {
      return;
    }

    const rdt: RedditPixelQueue = function (...args: any[]) {
      if (rdt.sendEvent) {
        rdt.sendEvent(...args);
      } else {
        rdt.callQueue.push(args);
      }
    };

    rdt.callQueue = [];
    localWindow.rdt = rdt;
    this.browser.injectScript(REDDIT_PIXEL_SCRIPT_URL, { async: true });
  }

  private initPixel(identifyEvent: JournifyEvent) {
    const userData = this.mapUserData(identifyEvent);
    this.callPixelHelper("init", this.settings.pixel_id, userData);
  }

  private mapUserData(event: JournifyEvent): object {
    const transformationsMap: Record<string, ((val: string) => string)[]> = {
      email: [trim, toLowerCase],
      externalId: [trim],
      phoneNumber: [trim, toE164],
    };

    return this.fieldsMapper.mapEvent(event, transformationsMap, {
      ignoreUnmappedProperties: true,
    });
  }

  private trackPixelEvent(ctx: Context): Context {
    const event = ctx.getEvent();
    const mappedEvent = this.eventMapper.applyEventMapping(event);
    if (!mappedEvent) {
      return ctx;
    }

    const mappedProperties = this.fieldsMapper.mapEvent(event);
    if (mappedProperties.event_id && !mappedProperties.conversionId) {
      mappedProperties.conversionId = mappedProperties.event_id;
    }
    delete mappedProperties.event_id;
    delete mappedProperties.client_dedup_id;

    const eventName = mappedEvent.pixelEventName || event.event;
    if (STANDARD_EVENTS.has(eventName)) {
      this.callPixelHelper("track", eventName, mappedProperties);
      return ctx;
    }

    this.callPixelHelper("track", "Custom", {
      ...mappedProperties,
      customEventName: eventName,
    });
    return ctx;
  }

  private callPixelHelper(...args: any[]) {
    if (this.testingMode) {
      this.logger.log(
        "Will call window.rdt with the following params in order:",
        args
      );
    } else {
      this.browser.window().rdt(...args);
    }
  }
}
