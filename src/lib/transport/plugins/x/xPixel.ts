/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Sync, Plugin, PluginDependencies, Logger } from "../plugin";
import { Browser } from "../../browser";
import { Context } from "../../context";
import { toSettingsObject } from "../lib/settings";
import {FieldsMapper, FieldsMapperFactory} from "../lib/fieldMapping";
import {EventMapper, EventMapperFactory} from "../lib/eventMapping";

const X_PIXEL_SCRIPT_URL = "https://static.ads-twitter.com/uwt.js";

declare global {
  interface Window {
    twq?: (...args: any[]) => void;
  }
}

type TRACKING_TYPE = "config" | "event";

export class XPixel implements Plugin {
  public readonly name = "x_pixel";
  private readonly browser: Browser;
  private readonly fieldMapperFactory: FieldsMapperFactory;
  private readonly eventMapperFactory: EventMapperFactory;
  private readonly testingMode: boolean;
  private readonly logger: Logger;
  private settings: Record<string, string>;
  private fieldsMapper: FieldsMapper;
  private eventMapper: EventMapper;

  public constructor(deps: PluginDependencies) {
    this.browser = deps.browser;
    this.eventMapperFactory = deps.eventMapperFactory;
    this.fieldMapperFactory = deps.fieldMapperFactory;
    this.testingMode = deps.testingWriteKey;
    this.logger = deps.logger;
    this.init(deps.sync);
  }

  identify(ctx: Context): Context {
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

    const mappedProperties = this.fieldsMapper.mapEvent(
      event,
      {},
      { ignoreUnmappedProperties: true }
    );
    this.callPixelHelper(
      "event",
      `tw-${this.settings.x_pixel_id}-${mappedEvent.pixelEventName}`,
      mappedProperties
    );

    return ctx;
  }

  private init(sync: Sync) {
    this.fieldsMapper = this.fieldMapperFactory.newFieldMapper(
      sync.field_mappings
    );
    this.eventMapper = this.eventMapperFactory.newEventMapper(sync.event_mappings);
    this.settings = toSettingsObject(sync.settings);

    if (this.testingMode) {
      this.logger.log(
        `X Pixel ${this.settings.x_pixel_id} is detected, but script is not injected because you are using a testing write key.`
      );
    } else {
      this.loadScript();
    }

    this.initPixel();
  }
  private initPixel() {
    this.callPixelHelper("config", this.settings.x_pixel_id);
  }
  private callPixelHelper(trackingType: TRACKING_TYPE, ...args: any[]) {
    if (this.testingMode) {
      this.logger.log(
        "Will call window.twq with the following params in order:",
        [trackingType, ...args]
      );
    } else {
      this.browser.window().twq(trackingType, ...args);
    }
  }

  /* eslint-disable */
  private loadScript() {
    const localWindow = this.browser.window();
    if (localWindow.twq) return;
    const localDocument = this.browser.document();
    let s, u, a;
    s = localWindow.twq = function () {
      s.exe ? s.exe.apply(s, arguments) : s.queue.push(arguments);
    };

    s.version = "1.1";
    s.queue = [];
    u = localDocument.createElement("script");
    u.async = !0;
    u.src = X_PIXEL_SCRIPT_URL;
    a = localDocument.getElementsByTagName("script")[0];
    a.parentNode.insertBefore(u, a);
  }
  /* eslint-enable */
}
