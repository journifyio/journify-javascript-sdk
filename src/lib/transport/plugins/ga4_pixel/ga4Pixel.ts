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
    gtag?: (...args: any[]) => void;
    JDataLayer?: any[];
  }
}

export class GA4Pixel implements Plugin {
  public readonly name = "ga4_pixel";
  private browser: Browser;
  private readonly user: User;
  private readonly testingMode: boolean;
  private readonly enableHashing: boolean;
  private readonly logger: Logger;
  private settings: Record<string, string>;

  public constructor(deps: PluginDependencies) {
    this.user = deps.user;
    this.browser = deps.browser;
    this.testingMode = deps.testingWriteKey;
    this.logger = deps.logger;
    this.enableHashing = deps.enableHashing;
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
      event.traits = await hashPII(event.traits);
    }

    if (Object.keys(event.traits).length > 0) {
      window.gtag("set", "user_properties", event.traits);
    }
    this.browser.window().gtag("config", this.settings.mesurement_id, {
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
            "Will call window.gtag with the following params in order:",
            ["event", "page_view", gtagEventParams]
          );
        }

        this.browser.window().gtag("event", "page_view", gtagEventParams);
        break;

      case JournifyEventType.GROUP:
        if (this.testingMode) {
          return this.logger.log(
            "Will call window.gtag with the following params in order:",
            ["event", "join_group", gtagEventParams]
          );
        }

        this.browser.window().gtag("event", "join_group", gtagEventParams);
        break;
      default:
        if (this.testingMode) {
          return this.logger.log(
            "Will call window.gtag with the following params in order:",
            ["event", event, gtagEventParams]
          );
        }

        this.browser.window().gtag("event", event, gtagEventParams);
    }
  }

  private init(sync: Sync) {
    this.settings = toSettingsObject(sync.settings);
    this.loadScript(this.settings.mesurement_id);
  }

  private loadScript(measurementID: string) {
    const localWindow = this.browser.window();

    localWindow.JDataLayer = localWindow.JDataLayer || [];

    // Using a custom data layer to avoid conflicts with gtags
    // Docs: https://developers.google.com/tag-platform/tag-manager/datalayer?hl=en#rename_the_data_layer
    localWindow.gtag = function gtag() {
      // This is very important to use the arguments object here, and it's not possible to use rest parameters
      // Pushing to our custom data layer
      // eslint-disable-next-line prefer-rest-params
      localWindow.JDataLayer.push(arguments);
    };

    // Setting up the config object for gtag
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

    localWindow.gtag("js", new Date());
    localWindow.gtag("config", measurementID, config);

    // Load the gtag script with l paramater to set the new data layer name
    this.browser.injectScript(
      `https://www.googletagmanager.com/gtag/js?id=${measurementID}&l=JDataLayer`,
      { async: true }
    );
  }
}
