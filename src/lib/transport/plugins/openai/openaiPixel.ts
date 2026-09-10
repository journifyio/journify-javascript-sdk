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
  private consentGranted = true;
  private pixelInitialized = false;

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
    if (!this.consentGranted) {
      return ctx;
    }

    const event = ctx.getEvent();
    const mappedEvents = this.eventMapper.applyEventMapping(event);
    if (mappedEvents.length === 0) {
      return ctx;
    }

    const mappedProperties = this.fieldsMapper.mapEvent(event);
    const eventId = mappedProperties.event_id;
    const customEventName = mappedProperties.custom_event_name;
    const optOut = mappedProperties.opt_out;
    delete mappedProperties.event_id;
    delete mappedProperties.custom_event_name;
    delete mappedProperties.opt_out;

    for (const mappedEvent of mappedEvents) {
      const eventName = mappedEvent.pixelEventName || event.event || "";
      const eventProperties = { ...mappedProperties };

      if (STANDARD_EVENTS.has(eventName)) {
        eventProperties.type = EVENT_TYPE_MAP[eventName];
        this.callPixelHelper("measure", eventName, eventProperties, {
          ...(eventId != null && { event_id: eventId }),
          ...(optOut === true && { opt_out: true }),
        });
        continue;
      }

      if (eventName !== "custom") {
        continue;
      }

      const customName = getValidCustomEventName(customEventName);
      if (!customName) {
        this.logger.log(
          "OpenAI Pixel custom events require properties.custom_event_name when destination_event_key is custom. Must be 1-64 chars, alphanumeric with dashes/underscores, and not match standard events."
        );
        continue;
      }

      eventProperties.type = "custom";
      this.callPixelHelper("measure", "custom", eventProperties, {
        custom_event_name: customName,
        ...(eventId != null && { event_id: eventId }),
        ...(optOut === true && { opt_out: true }),
      });
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
      this.setConsent(this.consentGranted);
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
    (stub as any).q = queue;
    localWindow.oaiq = stub;

    this.browser.injectScript(OPENAI_SCRIPT_URL, { async: true });
  }

  private initPixel(identifyEvent: JournifyEvent) {
    if (!this.consentGranted) {
      return;
    }

    const payload = this.buildInitPayload(identifyEvent);

    // Only initialize if we haven't already or if we have user data to update
    if (!this.pixelInitialized || (payload.user && Object.keys(payload.user).length > 0)) {
      this.callPixelHelper("init", payload);
      this.pixelInitialized = true;
    }
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

  private setConsent(consent: boolean) {
    this.consentGranted = consent;
    if (!this.testingMode) {
      this.callPixelHelper("consent", consent);
    }
  }

  private buildInitPayload(identifyEvent: JournifyEvent): Record<string, unknown> {
    const traits = (identifyEvent?.traits || {}) as Record<string, unknown>;
    const payload: Record<string, unknown> = {
      pixelId: this.settings.pixel_id,
    };

    // Add debug if configured
    if (this.settings.debug === "true" || this.testingMode) {
      payload.debug = true;
    }

    const user: Record<string, unknown> = {};

    // Email
    if (typeof traits.email_sha256 === "string" && traits.email_sha256.trim()) {
      user.email_sha256 = traits.email_sha256;
    } else if (typeof traits.hashed_email === "string" && traits.hashed_email.trim()) {
      user.email_sha256 = traits.hashed_email;
    }

    // Phone
    if (typeof traits.phone_number_sha256 === "string" && traits.phone_number_sha256.trim()) {
      user.phone_number_sha256 = traits.phone_number_sha256;
    } else if (typeof traits.hashed_phone === "string" && traits.hashed_phone.trim()) {
      user.phone_number_sha256 = traits.hashed_phone;
    }

    // External ID
    if (typeof traits.external_id_sha256 === "string" && traits.external_id_sha256.trim()) {
      user.external_id_sha256 = traits.external_id_sha256;
    }

    // First Name
    if (typeof traits.first_name_sha256 === "string" && traits.first_name_sha256.trim()) {
      user.first_name_sha256 = traits.first_name_sha256;
    } else if (typeof traits.hashed_first_name === "string" && traits.hashed_first_name.trim()) {
      user.first_name_sha256 = traits.hashed_first_name;
    }

    // Last Name
    if (typeof traits.last_name_sha256 === "string" && traits.last_name_sha256.trim()) {
      user.last_name_sha256 = traits.last_name_sha256;
    } else if (typeof traits.hashed_last_name === "string" && traits.hashed_last_name.trim()) {
      user.last_name_sha256 = traits.hashed_last_name;
    }

    // Country
    if (typeof traits.country_code === "string" && traits.country_code.trim()) {
      user.country = traits.country_code;
    } else if (typeof traits.country === "string" && traits.country.trim()) {
      user.country = traits.country;
    }

    // City
    if (typeof traits.city === "string" && traits.city.trim()) {
      user.city = traits.city;
    }

    // Region/State
    if (typeof traits.region === "string" && traits.region.trim()) {
      user.region = traits.region;
    } else if (typeof traits.state === "string" && traits.state.trim()) {
      user.region = traits.state;
    }

    // Postal Code (correct field name per OpenAI docs)
    if (typeof traits.postal_code === "string" && traits.postal_code.trim()) {
      user.postal_code = traits.postal_code;
    } else if (typeof traits.zip_code === "string" && traits.zip_code.trim()) {
      user.postal_code = traits.zip_code;
    }

    if (Object.keys(user).length > 0) {
      payload.user = user;
    }

    return payload;
  }
}

function getValidCustomEventName(customEventName: unknown): string {
  if (typeof customEventName !== "string") {
    return "";
  }

  const trimmedCustomEventName = customEventName.trim();
  if (
    /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/.test(
      trimmedCustomEventName
    ) &&
    !STANDARD_EVENTS.has(trimmedCustomEventName)
  ) {
    return trimmedCustomEventName;
  }

  return "";
}
