/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Plugin, PluginDependencies, Logger, Sync } from "../plugin";
import { Context } from "../../context";
import { FieldsMapper, FieldsMapperFactory } from "../lib/fieldMapping";
import { EventMapper, EventMapperFactory } from "../lib/eventMapping";
import { Browser } from "../../browser";
import { toSettingsObject } from "../lib/settings";
import { User } from "../../../domain/user";
import { getStoredIdentify } from "../lib/identify";
import { JournifyEvent, JournifyEventType } from "../../../domain/event";

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

const EVENT_TYPE_MAP: Record<string, string> = {
  page_viewed: "contents",
  contents_viewed: "contents",
  items_added: "contents",
  checkout_started: "contents",
  order_created: "contents",
  lead_created: "customer_action",
  registration_completed: "customer_action",
  appointment_scheduled: "customer_action",
  subscription_created: "plan_enrollment",
  trial_started: "plan_enrollment",
};

const OPENAI_SCRIPT_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js";

export class OpenAIPixel implements Plugin {
  public readonly name = "openai_pixel";
  private settings: Record<string, string> = {};
  private readonly browser: Browser;
  private readonly user: User;
  private readonly fieldMapperFactory: FieldsMapperFactory;
  private readonly eventMapperFactory: EventMapperFactory;
  private readonly testingMode: boolean;
  private readonly logger: Logger;
  private fieldsMapper!: FieldsMapper;
  private eventMapper!: EventMapper;

  public constructor(deps: PluginDependencies) {
    this.browser = deps.browser;
    this.user = deps.user;
    this.fieldMapperFactory = deps.fieldMapperFactory;
    this.eventMapperFactory = deps.eventMapperFactory;
    this.testingMode = deps.testingWriteKey;
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
    const customEventName = mappedProperties.custom_event_name;
    delete mappedProperties.custom_event_name;

    const eventName = mappedEvent?.pixelEventName || event.event || "";

    if (isStandardEvent(eventName)) {
      mappedProperties.type = EVENT_TYPE_MAP[eventName];
      const eventOptions: Record<string, any> = {};
      if (eventId != null) {
        eventOptions.event_id = eventId;
      }
      this.callPixelHelper("measure", eventName, mappedProperties, eventOptions);
    } else {
      mappedProperties.type = "custom";
      const eventOptions: Record<string, any> = {};
      const customName = getCustomEventName(customEventName, eventName);
      if (customName) {
        eventOptions.custom_event_name = customName;
      }
      if (eventId != null) {
        eventOptions.event_id = eventId;
      }
      this.callPixelHelper("measure", "custom", mappedProperties, eventOptions);
    }

    return ctx;
  }

  private init(sync: Sync) {
    this.settings = toSettingsObject(sync.settings);
    this.fieldsMapper = this.fieldMapperFactory.newFieldMapper(sync.field_mappings);
    this.eventMapper = this.eventMapperFactory.newEventMapper(sync.event_mappings);

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

  private initPixel(identifyEvent: JournifyEvent) {
    this.callPixelHelper("init", this.buildInitPayload(identifyEvent));
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

  private buildInitPayload(identifyEvent: JournifyEvent): Record<string, unknown> {
    const traits = (identifyEvent?.traits || {}) as Record<string, unknown>;
    const payload: Record<string, unknown> = {
      pixelId: this.settings.pixel_id,
    };
    const user: Record<string, unknown> = {};

    if (typeof traits.email_sha256 === "string" && traits.email_sha256.trim()) {
      user.email_sha256 = traits.email_sha256;
    } else if (
      typeof traits.hashed_email === "string" &&
      traits.hashed_email.trim()
    ) {
      user.email_sha256 = traits.hashed_email;
    }

    if (
      typeof traits.external_id_sha256 === "string" &&
      traits.external_id_sha256.trim()
    ) {
      user.external_id_sha256 = traits.external_id_sha256;
    }

    if (typeof traits.country_code === "string" && traits.country_code.trim()) {
      user.country = traits.country_code;
    } else if (typeof traits.country === "string" && traits.country.trim()) {
      user.country = traits.country;
    }

    if (typeof traits.city === "string" && traits.city.trim()) {
      user.city = traits.city;
    }

    if (typeof traits.zip_code === "string" && traits.zip_code.trim()) {
      user.zip_code = traits.zip_code;
    } else if (
      typeof traits.postal_code === "string" &&
      traits.postal_code.trim()
    ) {
      user.zip_code = traits.postal_code;
    }

    if (Object.keys(user).length > 0) {
      payload.user = user;
    }

    return payload;
  }
}

function isStandardEvent(eventName: string): boolean {
  return STANDARD_EVENTS.has(eventName);
}

function getCustomEventName(
  mappedCustomEventName: unknown,
  fallbackEventName?: string
): string {
  if (
    typeof mappedCustomEventName === "string" &&
    mappedCustomEventName.trim().length > 0
  ) {
    return mappedCustomEventName;
  }

  if (
    typeof fallbackEventName === "string" &&
    fallbackEventName.trim().length > 0 &&
    fallbackEventName !== "custom"
  ) {
    return fallbackEventName;
  }

  return "";
}
