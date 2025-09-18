/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Logger, Plugin, PluginDependencies, Sync } from "../plugin";
import { Context } from "../../context";
import {
  EventMapper,
  EventMapperImpl,
  FieldsMapper,
  FieldsMapperFactory,
} from "../lib/mapping";
import { toSettingsObject } from "../lib/settings";
import { getStoredIdentify } from "../lib/identify";
import { Browser } from "../../browser";
import { User } from "../../../domain/user";
import { JournifyEvent, JournifyEventType } from "../../../domain/event";
import { toLowerCase, trim } from "../lib/tranformations";
import { matchFilters } from "../lib/filters";

declare global {
  interface Window {
    pintrk?: { queue: any[]; version: string } & ((...args: any[]) => void);
  }
}

const PINTEREST_PIXEL_SCRIPT_URL = "https://s.pinimg.com/ct/core.js";
type TRACKING_TYPE = "load" | "track";

export class PinterestTag implements Plugin {
  public readonly name = "pinterest_tag";
  private readonly browser: Browser;
  private readonly user: User;
  private readonly fieldMapperFactory: FieldsMapperFactory;
  private readonly testingMode: boolean;
  private readonly logger: Logger;
  private settings: Record<string, string>;
  private fieldsMapper: FieldsMapper;
  private eventMapper: EventMapper;

  public constructor(deps: PluginDependencies) {
    this.user = deps.user;
    this.eventMapper = deps.eventMapperFactory.newEventMapper(
      deps.sync.event_mappings
    );
    this.browser = deps.browser;
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

    this.initTag(event);
    return this.trackTagEvent(ctx);
  }

  page(ctx: Context): Promise<Context> | Context {
    return this.trackTagEvent(ctx);
  }

  track(ctx: Context): Promise<Context> | Context {
    return this.trackTagEvent(ctx);
  }

  group(ctx: Context): Promise<Context> | Context {
    return this.trackTagEvent(ctx);
  }

  updateSettings(sync: Sync): void {
    this.init(sync);
  }

  private init(sync: Sync) {
    this.fieldsMapper = this.fieldMapperFactory.newFieldMapper(
      sync.field_mappings
    );
    this.eventMapper = new EventMapperImpl(sync.event_mappings);
    this.settings = toSettingsObject(sync.settings);

    if (this.testingMode) {
      this.logger.log(
        `Pinterest Tag ${this.settings.tag_id} is detected, but script is not injected because you are using a testing write key.`
      );
    } else {
      this.loadScript();
    }

    const event = getStoredIdentify(this.user);
    this.initTag(event);
  }

  private loadScript() {
    const localWindow = this.browser.window();
    if (localWindow.pintrk) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    localWindow.pintrk = function () {
      // eslint-disable-next-line prefer-rest-params
      localWindow.pintrk.queue.push(Array.prototype.slice.call(arguments));
    };

    const localDocument = this.browser.document();
    const n = localWindow.pintrk;
    (n.queue = []), (n.version = "3.0");
    const t = localDocument.createElement("script");
    (t.async = !0), (t.src = PINTEREST_PIXEL_SCRIPT_URL);
    const r = localDocument.getElementsByTagName("script")[0];
    r.parentNode.insertBefore(t, r);
  }

  private initTag(identifyEvent: JournifyEvent) {
    const transformationsMap: Record<string, ((val: string) => string)[]> = {
      em: [trim, toLowerCase],
    };
    const userData = this.fieldsMapper.mapEvent(
      identifyEvent,
      transformationsMap,
      { ignoreUnmappedProperties: true }
    );
    this.callPintrk("load", this.settings.tag_id, userData);
  }

  private callPintrk(trackingType: TRACKING_TYPE, ...args: any[]) {
    if (this.testingMode) {
      this.logger.log(
        "Will call window.pintrk with the following params in order:",
        [trackingType, ...args]
      );
    } else {
      this.browser.window().pintrk(trackingType, ...args);
    }
  }

  private trackTagEvent(ctx: Context): Context {
    const event = ctx.getEvent();
    const eventMapping = this.eventMapper.getEventMapping(event);
    if (!eventMapping || !matchFilters(event, eventMapping?.filters)) {
      return ctx;
    }

    const mappedProperties = this.fieldsMapper.mapEvent(
      event,
      {},
      { ignoreUnmappedProperties: true }
    );

    const eventName = eventMapping?.pixelEventName || event.event;
    if (!eventMapping) {
      return ctx;
    }

    this.callPintrk("track", eventName, mappedProperties);
    return ctx;
  }
}
