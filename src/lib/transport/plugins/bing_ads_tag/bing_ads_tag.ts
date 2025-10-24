import { Sync, Plugin, PluginDependencies, Logger } from "../plugin";
import { toSettingsObject } from "../lib/settings";
import { User } from "../../../domain/user";
import { Context } from "../../context";
import { Browser, InjectScriptOptions } from "../../browser";
import { getStoredIdentify } from "../lib/identify";
import { hashPII } from "../lib/hashPII";
import { FieldsMapper } from "../lib/fieldMapping";
import { EventMapper } from "../lib/eventMapping";
import { JournifyEventType } from "../../../domain/event";

declare global {
  interface Window {
    UET?: (setup: unknown) => void;
    uetq?: unknown[];
  }
}

// Event Paramaters https://help.ads.microsoft.com/apex/index/3/en/60123
export class BingAdsTag implements Plugin {
  public readonly name = "bing_ads_tag";
  private readonly user: User;
  private readonly testingMode: boolean;
  private readonly enableHashing: boolean;
  private browser: Browser;
  private readonly fieldsMapper: FieldsMapper;
  private readonly eventMapper: EventMapper;
  private settings: Record<string, string>;
  private logger: Logger;

  public constructor(deps: PluginDependencies) {
    this.browser = deps.browser;
    this.user = deps.user;
    this.testingMode = deps.testingWriteKey;
    this.enableHashing = deps.enableHashing;
    this.fieldsMapper = deps.fieldMapperFactory.newFieldMapper(
      deps.sync.field_mappings
    );
    this.eventMapper = deps.eventMapperFactory.newEventMapper(
      deps.sync.event_mappings
    );
    this.settings = {};
    this.logger = deps.logger;
    this.init(deps.sync);
  }

  public updateSettings(sync: Sync): void {
    this.init(sync);
  }

  public async identify(ctx: Context): Promise<Context> {
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

    // keep only pid.em and pid.ph
    const mappedEvent = this.fieldsMapper.mapEvent(event);
    for (const key in mappedEvent) {
      if (key !== "pid") {
        delete mappedEvent[key];
      } else if (mappedEvent[key] && typeof mappedEvent[key] === "object") {
        for (const pidKey in mappedEvent[key]) {
          if (pidKey !== "em" && pidKey !== "ph") {
            delete mappedEvent[key][pidKey];
          }
        }
      }
    }

    this.browser.window().uetq.push("set", mappedEvent);
    return ctx;
  }
  public track(ctx: Context): Context {
    if (this.browser.window()?.uetq === undefined) {
      console.warn("Bing Ads Tag not initialized properly");
      return ctx;
    }
    const event = ctx.getEvent();
    const mappedEvent = this.eventMapper.applyEventMapping(event);
    if (!mappedEvent) {
      return ctx;
    }

    const mappedFields = this.fieldsMapper.mapEvent(event);
    // remove pid (user info), we send it only on set calls
    for (const key in mappedFields) {
      if (key === "pid") {
        delete mappedFields[key];
        break;
      }
    }

    this.browser
      .window()
      .uetq.push("event", mappedEvent.pixelEventName, mappedFields);
    return ctx;
  }

  public page(ctx: Context): Context {
    this.browser.window().uetq?.push("pageLoad");
    return ctx;
  }

  group(ctx: Context): Context {
    return ctx;
  }
  private init(sync: Sync) {
    this.settings = toSettingsObject(sync.settings);
    if (!this.settings.bing_ads_tag_id) {
      this.logger.log(
        "Bing Ads Tag is not injected because the pixel id is not set."
      );
      return;
    }
    this.loadScript(this.settings.bing_ads_tag_id);
  }

  private loadScript(bingAdsTagId: string): void {
    const localWindow = this.browser.window();
    if (localWindow.uetq) {
      return;
    }
    const scriptUrl = `https://bat.bing.com/bat.js`;
    const async = true;

    const onload = () => {
      localWindow.uetq = localWindow.uetq || [];
      const setup = {
        ti: bingAdsTagId,
        q: localWindow.uetq,
      };
      localWindow.uetq = new localWindow.UET(setup);
    };
    const opts: InjectScriptOptions = {
      async: async,
      onload: onload,
    };
    this.browser.injectScript(scriptUrl, opts);
  }
}
