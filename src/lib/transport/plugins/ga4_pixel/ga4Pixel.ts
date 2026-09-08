/* eslint-disable  @typescript-eslint/no-explicit-any */
import { JournifyEventType } from "../../../domain/event";
import { User } from "../../../domain/user";
import { Browser } from "../../browser";
import { Context } from "../../context";
import { getStoredIdentify } from "../lib/identify";
import { toSettingsObject } from "../lib/settings";
import { Sync, Plugin, PluginDependencies, Logger } from "../plugin";
import { hashPII } from "../lib/hashPII";

declare global {
  interface Window {
    JDataLayer?: any[];
  }
}

export class GA4Pixel implements Plugin {
  public readonly name = "ga4_pixel";
  private browser: Browser;
  private readonly user: User;
  private readonly testingMode: boolean;
  private readonly enableHashing: boolean;
  private readonly additionalPIIKeys: string[];
  private readonly logger: Logger;
  private settings: Record<string, string>;

  public constructor(deps: PluginDependencies) {
    this.user = deps.user;
    this.browser = deps.browser;
    this.testingMode = deps.testingWriteKey;
    this.logger = deps.logger;
    this.enableHashing = deps.enableHashing;
    this.additionalPIIKeys = deps.additionalPIIKeys;
    this.init(deps.sync);
  }

  // implement the interface
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
      event.traits = await hashPII(event.traits, this.additionalPIIKeys);
    }

    if (Object.keys(event.traits).length > 0) {
      this.pushToGtag("set", "user_properties", event.traits);
    }
    this.pushToGtag("config", this.settings.mesurement_id, {
      user_id: event.userId,
    });
    return ctx;
  }

  track(ctx: Context) {
    return this.trackPixelEvent(ctx);
  }

  page(ctx: Context) {
    return this.trackPixelEvent(ctx);
  }

  group(ctx: Context) {
    return this.trackPixelEvent(ctx);
  }

  updateSettings(sync: Sync) {
    this.init(sync);
  }

  private trackPixelEvent(ctx: Context): Context {
    const event = ctx.getEvent();
    this.callPixelHelper(event.type, event.event, event.properties);
    return ctx;
  }

  private callPixelHelper(type: JournifyEventType, event: string, args: any) {
    const gtagEventParams = { ...args, send_to: this.settings.mesurement_id };
    switch (type) {
      case JournifyEventType.PAGE:
        if (this.testingMode) {
          return this.logger.log(
            "Will call Journify's pushToGtag with the following params in order:",
            ["event", "page_view", gtagEventParams]
          );
        }

         this.pushToGtag("event", "page_view", gtagEventParams);
        break;

      case JournifyEventType.GROUP:
        if (this.testingMode) {
          return this.logger.log(
            "Will call Journify's pushToGtag with the following params in order:",
            ["event", "join_group", gtagEventParams]
          );
        }

         this.pushToGtag("event", "join_group", gtagEventParams);
        break;
      default:
        if (this.testingMode) {
          return this.logger.log(
            "Will call Journify's pushToGtag with the following params in order:",
            ["event", event, gtagEventParams]
          );
        }

         this.pushToGtag("event", event, gtagEventParams);
    }
  }

  private init(sync: Sync) {
    this.settings = toSettingsObject(sync.settings);
    this.loadScript(this.settings.mesurement_id);
  }

  private pushToGtag!: (...args: any[]) => void;


  private loadScript(measurementID: string) {
    const localWindow = this.browser.window();

    localWindow.JDataLayer = localWindow.JDataLayer || [];

    // Using a custom gtag to push to JDatalayer to avoid conflicts with any existing gtags.
    // Docs: https://developers.google.com/tag-platform/tag-manager/datalayer?hl=en#rename_the_data_layer
    this.pushToGtag = function () {
      // eslint-disable-next-line prefer-rest-params
      localWindow.JDataLayer.push(arguments);
    };

    // Setting up the config object
    const config: Record<string, any> = {};
    if (this.settings?.cookie_domain) {
      config.cookie_domain = this.settings.cookie_domain;
    }
    if (this.settings?.cookie_prefix) {
      config.cookie_prefix = this.settings.cookie_prefix;
    }
    if (this.settings?.cookie_expires) {
      config.cookie_expires = this.settings.cookie_expires;
    }

     this.pushToGtag("js", new Date());
     this.pushToGtag("config", measurementID, config);

    // Load the gtag script with l paramater to set the new data layer name
    this.browser.injectScript(
      `https://www.googletagmanager.com/gtag/js?id=${measurementID}&l=JDataLayer`,
      { async: true }
    );
  }
}
