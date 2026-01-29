/* eslint-disable @typescript-eslint/no-explicit-any */
import { Plugin, PluginDependencies, Sync } from "../plugin";
import { Context } from "../../context";
import { toSettingsObject } from "../lib/settings";
import { User } from "../../../domain/user";
import isObject from "lodash.isobject";
import isArray from "lodash.isarray";
import { CleverTapWrapper, SiteData } from "./cleverTapWrapper";
import { hashPII } from "../lib/hashPII";

export class CleverTapPlugin implements Plugin {
  public readonly name = "celvertap";
  private readonly sdk: CleverTapWrapper;
  private readonly user: User;
  private readonly enableHashing: boolean;

  public constructor(deps: PluginDependencies<CleverTapWrapper>) {
    this.user = deps.user;
    this.sdk = deps.externalSDK;
    this.enableHashing = deps.enableHashing;
    this.init(deps.sync);
  }

  async identify(ctx: Context): Promise<Context> {
    let traits = ctx.getEvent()?.traits || {};
    if (this.user) {
      traits = {
        ...this.user.getTraits(),
        ...traits,
      };
    }

    if (this.enableHashing) {
      traits = await hashPII(traits);
    }

    const siteData: SiteData = {
      Identity: this.user?.getUserId(),
    };

    for (const [key, value] of Object.entries(traits)) {
      switch (key) {
        case "birthday":
          siteData.DOB = value as string;
          break;
        case "avatar":
          siteData.Photo = value as string;
          break;
        case "gender":
          siteData.Gender = (value as string).charAt(0).toUpperCase() as
            | "M"
            | "F";
          break;
        case "email":
          siteData.Email = value as string;
          break;
        case "phone":
          siteData.Phone = value as string;
          break;
        case "name":
          siteData.Name = value as string;
          break;
        default:
          siteData[key] = value;
      }
    }

    this.sdk.pushProfileData({ Site: siteData });

    return ctx;
  }
  page(ctx: Context): Promise<Context> | Context {
    const event = ctx.getEvent();
    const eventPage = event.context.page;
    const cleverTapEventProps = {
      Referrer: eventPage.referrer,
      Search: eventPage.search,
      Title: eventPage.title,
      Path: eventPage.path,
      URL: eventPage.url,
      UserAgent: event.context.userAgent,
      ...event.properties,
    };

    this.sdk.pushEvent("Web Page Viewed", cleverTapEventProps);
    return ctx;
  }

  track(ctx: Context): Promise<Context> | Context {
    const event = ctx.getEvent();
    let eventName = event.event;
    if (eventName === "Order Completed") {
      eventName = "Charged";
    }

    const eventProps = event.properties;
    for (const [key, value] of Object.entries(eventProps)) {
      if (isObject(value) || isArray(value)) {
        eventProps[key] = JSON.stringify(value);
      }
    }

    this.sdk.pushEvent(eventName, event.properties);
    return ctx;
  }

  updateSettings(sync: Sync): void {
    this.init(sync);
  }

  group(ctx: Context): Promise<Context> | Context {
    return ctx;
  }

  private init(sync: Sync): void {
    const settings = toSettingsObject(sync.settings);
    this.sdk.init(settings.account_id, settings.region?.trim());
  }
}
