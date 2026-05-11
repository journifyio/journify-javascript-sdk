/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Plugin, PluginDependencies, Logger, Sync } from "../plugin";
import { Context } from "../../context";
import { FieldsMapper } from "../lib/fieldMapping";
import { EventMapper } from "../lib/eventMapping";
import { JournifyEvent, JournifyEventType } from "../../../domain/event";
import { User } from "../../../domain/user";
import { Browser } from "../../browser";
import { toSettingsObject } from "../lib/settings";
import { getStoredIdentify } from "../lib/identify";

declare global {
  interface Window {
    oaiq?: (...args: any[]) => void;
  }
}

const STANDARD_EVENTS = new Set<string>([
  "page_viewed",
  "contents_viewed",
  "items_added",
  "checkout_started",
  "order_created",
  "lead_created",
  "registration_completed",
  "appointment_scheduled",
  "subscription_created",
  "trial_started",
]);

const OPENAI_SCRIPT_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js";

export class OpenAIPixel implements Plugin {
  public readonly name = "openai_pixel";
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

    const eventName = mappedEvent?.pixelEventName || event.event || "";

    if (isStandardEvent(eventName)) {
      this.callPixelHelper("measure", eventName, mappedProperties, {
        event_id: eventId,
      });
    } else {
      this.callPixelHelper("measure", "custom", mappedProperties, {
        event_id: eventId,
        custom_event_name: eventName,
      });
    }

    return ctx;
  }

  private init(sync: Sync) {
    this.settings = toSettingsObject(sync.settings);
    if (this.testingMode) {
      this.logger.log(
        `OpenAI Pixel ${this.settings.pixel_id} is detected, but script is not injected because you are using a testing write key.`
      );
    } else {
      this.loadScript();
    }

    const event = getStoredIdentify(this.user);
    this.initPixel(event);
  }

  private loadScript(): void {
    const localWindow = this.browser.window();
    if (localWindow.oaiq) {
      return;
    }

    const queue: any[][] = [];
    const stub = (...args: any[]) => {
      queue.push(args);
    };
    (stub as any).queue = queue;
    localWindow.oaiq = stub;

    this.browser.injectScript(OPENAI_SCRIPT_URL, { async: true });
  }

  private initPixel(_identifyEvent: JournifyEvent) {
    this.callPixelHelper("init", { pixelId: this.settings.pixel_id });
  }

  private callPixelHelper(...args: any[]) {
    if (this.testingMode) {
      this.logger.log(
        "Will call window.oaiq with the following params in order:",
        args
      );
      return;
    }

    this.browser.window().oaiq?.(...args);
  }
}

function isStandardEvent(eventName: string): boolean {
  return STANDARD_EVENTS.has(eventName);
}
