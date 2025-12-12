import * as uuid from "uuid";
import { User } from "../domain/user";
import { JournifyEvent, JournifyEventType } from "../domain/event";
import { ExternalIdsSessionCache, ExternalIds } from "../domain/externalId";
import { LIB_VERSION } from "../generated/libVersion";
import { SESSION_ID_PERSISTENCE_KEY, Store, StoresGroup } from "../store/store";
import { Group } from "../domain/group";
import { Browser } from "./browser";
import { Traits } from "../domain/traits";
import { SessionStore } from "../store/sessionStore";

export interface EventFactory {
  setUser(user: User): void;
  setGroup(group: Group): void;

  newIdentifyEvent(): Promise<JournifyEvent>;
  newTrackEvent(
    eventName: string,
    properties?: JournifyEvent["properties"],
    traits?: JournifyEvent["traits"]
  ): Promise<JournifyEvent>;
  newPageEvent(
    pageName: string,
    properties?: JournifyEvent["properties"],
    traits?: JournifyEvent["traits"]
  ): Promise<JournifyEvent>;
  newGroupEvent(): Promise<JournifyEvent>;
}

export class EventFactoryImpl implements EventFactory {
  private user: User;
  private group: Group;
  private readonly browser: Browser;
  private readonly stores: StoresGroup;
  private readonly cookiesStore: Store;
  private readonly externalIdsSessionCache: ExternalIdsSessionCache;

  public constructor(
    stores: StoresGroup,
    cookiesStore: Store,
    browser: Browser,
    externalIdsSessionCache: ExternalIdsSessionCache
  ) {
    this.stores = stores;
    this.cookiesStore = cookiesStore;
    this.browser = browser;
    this.externalIdsSessionCache = externalIdsSessionCache;
  }

  public setGroup(group: Group) {
    this.group = group;
  }

  public setUser(user: User) {
    this.user = user;
  }

  public newIdentifyEvent(): Promise<JournifyEvent> {
    const baseEvent: JournifyEvent = {
      type: JournifyEventType.IDENTIFY,
      userId: this.user?.getUserId() || null,
      anonymousId: this.user?.getAnonymousId(),
      traits: this.user?.getTraits(),
    };

    return this.normalizeEvent(baseEvent);
  }

  public async newTrackEvent(
    eventName: string,
    properties?: JournifyEvent["properties"],
    traits?: JournifyEvent["traits"]
  ): Promise<JournifyEvent> {
    const mergedTraits = {
      ...this.appendTraitsFromProperties(traits, properties),
      ...(this.user?.getTraits() || {}),
      ...traits,
    };

    const baseEvent: JournifyEvent = {
      type: JournifyEventType.TRACK,
      event: eventName,
      properties,
      userId: this.getUserID(mergedTraits),
      anonymousId: this.user?.getAnonymousId(),
      traits: mergedTraits,
    };

    return this.normalizeEvent(baseEvent);
  }

  public async newPageEvent(
    pageName: string,
    properties?: JournifyEvent["properties"],
    traits?: JournifyEvent["traits"]
  ): Promise<JournifyEvent> {
    const mergedTraits = {
      ...this.appendTraitsFromProperties(traits, properties),
      ...(this.user?.getTraits() || {}),
      ...traits,
    };

    const baseEvent: JournifyEvent = {
      type: JournifyEventType.PAGE,
      name: pageName,
      properties,
      userId: this.getUserID(mergedTraits),
      anonymousId: this.user?.getAnonymousId(),
      traits: mergedTraits,
    };

    return this.normalizeEvent(baseEvent);
  }

  public newGroupEvent(): Promise<JournifyEvent> {
    const baseEvent: JournifyEvent = {
      type: JournifyEventType.GROUP,
      userId: this.user?.getUserId() || null,
      anonymousId: this.user?.getAnonymousId(),
      traits: this.group?.getTraits(),
    };

    return this.normalizeEvent(baseEvent);
  }

  private async normalizeEvent(
    baseEvent: JournifyEvent
  ): Promise<JournifyEvent> {
    const ctx = baseEvent?.context || {};
    ctx.userAgent = this.browser.navigator().userAgent;
    ctx.groupId = this.group?.getGroupId() || null;

    ctx.page = {
      referrer: this.browser.document().referrer,
      search: this.browser.location().search,
      title: this.browser.document().title,
      path: this.browser.canonicalPath(),
      url: this.browser.canonicalUrl(),
    };

    // TODO: Refactor StoreGroup to choose which storage you want to use
    const campaign = this.browser.utmCampaign(
      this.browser.location().search,
      new SessionStore(this.browser)
    );
    if (campaign) {
      ctx.campaign = campaign;
    }

    if (!ctx.locale) {
      const navigator = this.browser.navigator();
      ctx.locale = navigator
        ? navigator.language || navigator["userLanguage"]
        : undefined;
    }

    if (!ctx.library) {
      ctx.library = {
        name: "@journifyio/js-sdk",
        version: LIB_VERSION,
      };
    }

    const sessionId = this.stores.get<string>(SESSION_ID_PERSISTENCE_KEY);
    if (sessionId) {
      ctx.session = {
        id: sessionId,
      };
    }

    const normalizedEvent: JournifyEvent = {
      ...baseEvent,
      messageId: uuid.v4(),
      timestamp: new Date(),
      externalIds: this.getExternalIDs(),
      context: ctx,
    };

    return normalizedEvent;
  }

  private appendTraitsFromProperties(
    traits: Traits,
    properties?: JournifyEvent["properties"]
  ): Traits {
    const mergedTraits = { ...(traits || {}) };
    if (properties?.hashed_email) {
      mergedTraits.hashed_email = properties.hashed_email as string;
    }

    if (properties?.email) {
      mergedTraits.email = properties.email as string;
    }

    if (properties?.hashed_phone) {
      mergedTraits.hashed_phone = properties.hashed_phone as string;
    }

    if (properties?.phone) {
      mergedTraits.phone = properties.phone as string;
    }

    if (properties?.userId) {
      mergedTraits.userId = properties.userId as string;
    }
    return mergedTraits as Traits;
  }

  private getUserID(mergedTraits: Traits = {}): string | null {
    const userId = this.user?.getUserId();
    if (userId) {
      return userId;
    }

    if (mergedTraits.userId) {
      return mergedTraits.userId as string;
    }

    if (mergedTraits.id) {
      return mergedTraits.id as string;
    }

    return null;
  }
  private getExternalIDs(): ExternalIds {
    const potentialExternalIds = {
      facebook_click_id: this.cookiesStore.get("_fbc"),
      pinterest_click_id: this.cookiesStore.get("_epik"),
      tiktok_click_id: this.cookiesStore.get("ttclid"),
      snapchat_click_id: this.cookiesStore.get("_scclid"),
      facebook_browser_id: this.cookiesStore.get("_fbp"),
      snapchat_scid: this.cookiesStore.get("_scid"),
      tiktok_ttp: this.cookiesStore.get("_ttp"),
      microsoft_click_id: this.cookiesStore.get("_uetmsclkid"),
      linkedin_click_id: this.cookiesStore.get("li_fat_id"),
      google_click_id: this.getGoogleClickId(),
      twitter_click_id: this.getTwitterClickId(),
      snapchat_advertiser_cookie_1:
        this.cookiesStore.get("snapchat_advertiser_cookie_1") ||
        this.user?.getAnonymousId(),
      ...this.externalIdsSessionCache.getExternalIds(),
    };

    const userExternalIds = this.user?.getExternalIds();
    if (userExternalIds) {
      for (const key in userExternalIds) {
        potentialExternalIds[key] = userExternalIds[key];
      }
    }

    return Object.entries(potentialExternalIds).reduce(
      (accumulator, [key, value]) => {
        if (value) {
          accumulator[key] = "" + value;
        }

        return accumulator;
      },
      {}
    );
  }

  private getGoogleClickId(): string | null {
    const gclAwID = this.getGoogleClickIdFromGclCookie("_gcl_aw");
    if (gclAwID?.length > 0) {
      return gclAwID;
    }

    const gclDcId = this.getGoogleClickIdFromGclCookie("_gcl_dc");
    if (gclDcId?.length > 0) {
      return gclDcId;
    }

    const fpgClaw = this.getGoogleClickIdFromFPGCookie("FPGCLAW");
    if (fpgClaw?.length > 0) {
      return fpgClaw;
    }

    return this.getGoogleClickIdFromFPGCookie("FPGCLDC");
  }

  private getGoogleClickIdFromGclCookie(cookieName: string): string | null {
    const cookieValue: string = this.cookiesStore.get(cookieName);
    if (!cookieValue) {
      return null;
    }
    const split = cookieValue.split(".");
    if (split.length < 3) {
      return null;
    }

    return split.slice(2).join("");
  }

  private getGoogleClickIdFromFPGCookie(cookieName: string): string | null {
    const cookieValue: string = this.cookiesStore.get(cookieName);
    if (!cookieValue) {
      return null;
    }
    const startIndex = cookieValue.indexOf(".k");
    if (startIndex === -1) {
      return null;
    }
    const endIndex = cookieValue.indexOf("$", startIndex);
    if (endIndex === -1) {
      return null;
    }

    return cookieValue.substring(startIndex + 2, endIndex);
  }

  private getTwitterClickId(): string {
    let cookie: string = this.cookiesStore.get("_twclid");
    if (!cookie) {
      return cookie;
    }

    try {
      cookie = decodeURI(cookie);
      const obj = JSON.parse(cookie);
      if (obj?.twclid) {
        return obj.twclid;
      }
      return cookie;
    } catch (e) {
      return cookie;
    }
  }
}
