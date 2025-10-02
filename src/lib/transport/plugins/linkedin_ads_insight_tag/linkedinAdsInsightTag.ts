/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Logger, Plugin, PluginDependencies, Sync } from "../plugin";
import { Context } from "../../context";
import { Browser } from "../../browser";
import { FieldsMapper } from "../lib/fieldMapping";
import { EventMapper } from "../lib/eventMapping";
import { toSettingsObject } from "../lib/settings";
import { toInt } from "../lib/tranformations";
import {getStoredIdentify} from "../lib/identify";
import {JournifyEventType} from "../../../domain/event";
import {hashPII} from "../lib/hashPII";
import {User} from "../../../domain/user";

declare global {
  interface Window {
    _linkedin_data_partner_ids?: any[];
    lintrk: {
      (...args: any[]): void;
      q?: [any, any][];
    };
  }
}

const LINKEDIN_INSIGHT_TAG_SCRIPT_URL =
  "https://snap.licdn.com/li.lms-analytics/insight.min.js";

export class LinkedinAdsInsightTag implements Plugin {
  public readonly name: string = "linkedin_ads_insight_tag";
  private settings: Record<string, string> = {};
  private readonly user: User;
  private readonly enableHashing: boolean;
  private readonly browser: Browser;
  private readonly fieldsMapper: FieldsMapper;
  private readonly eventMapper: EventMapper;
  private readonly testingMode: boolean;
  private readonly logger: Logger;

  public constructor(deps: PluginDependencies) {
    this.browser = deps.browser;
    this.user = deps.user;
    this.enableHashing = deps.enableHashing;
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

  async group(ctx: Context): Promise<Context> {
    await this.identify(ctx)
    return this.trackInsightTagEvent(ctx);
  }

  async identify(ctx: Context): Promise<Context> {
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

    if (this.enableHashing) {
      event.traits = await hashPII(event.traits);
    }

    const mappedEvent = this.fieldsMapper.mapEvent(event);
    if (mappedEvent?.email) {
      this.lintrk("setUserData", {email: mappedEvent.email});
    }
    return ctx;
  }

  async page(ctx: Context): Promise<Context> {
    await this.identify(ctx)
    return this.trackInsightTagEvent(ctx);
  }

  async track(ctx: Context): Promise<Context> {
    await this.identify(ctx)
    return this.trackInsightTagEvent(ctx);
  }

  updateSettings(sync: Sync): void {
    this.init(sync);
  }

  private init(sync: Sync) {
    this.settings = toSettingsObject(sync.settings);
    if (this.testingMode) {
      this.logger.log(
        `Linkedin Insight Tag ${this.settings.linkedin_partner_id} is detected, but script is not injected because you are using a testing write key.`
      );
    } else {
      this.loadTagScript();
    }
  }

  private loadTagScript() {
    const localWindow = this.browser.window();
    localWindow._linkedin_data_partner_ids =
      window._linkedin_data_partner_ids || [];
    localWindow._linkedin_data_partner_ids.push(
      this.settings.linkedin_partner_id
    );

    const linktrk = localWindow.lintrk;
    if (!linktrk) {
      localWindow.lintrk = function (a, b) {
        localWindow.lintrk.q.push([a, b]);
      };
      localWindow.lintrk.q = [];
    }

    this.browser.injectScript(LINKEDIN_INSIGHT_TAG_SCRIPT_URL, { async: true });
  }

  private trackInsightTagEvent(ctx: Context): Promise<Context> | Context {
    const event = ctx.getEvent();
    const mappedEvent = this.eventMapper.applyEventMapping(event);
    if (!mappedEvent) {
      return ctx;
    }

    const mappedFields = this.fieldsMapper.mapEvent(
      event,
      {},
      { ignoreUnmappedProperties: true }
    );
    delete mappedFields.email;

    this.lintrk("track", {
      conversion_id: toInt(mappedEvent.pixelEventName),
      ...mappedFields,
    });

    return ctx;
  }

  private lintrk(...args: any[]) {
    if (this.testingMode) {
      this.logger.log(
        "Will call window.lintrk with the following params in order:",
        args
      );
      return;
    }

    this.browser.window().lintrk(...args);
  }
}
