import { v4 as uuid } from "uuid";
import { Traits, USER_TRAITS_PERSISTENCE_KEY } from "./traits";
import { StoresGroup } from "../store/store";
import { ExternalIds } from "./externalId";
import { normalizePhone, parseNumberToString } from "../lib/utils";
import { HttpCookieService } from "../lib/httpCookieService";
import { SentryWrapper } from "../lib/sentry";

const ANONYMOUS_ID_PERSISTENCE_KEY = "journifyio_anonymous_id";
const USER_ID_PERSISTENCE_KEY = "journifyio_user_id";
const EXTERNAL_IDs_PERSISTENCE_KEY = "journifyio_external_ids";

export interface User {
  identify(
    userId: string,
    traits?: Traits,
    externalIds?: ExternalIds
  ): Promise<void>;
  getUserId(): string | null;
  getAnonymousId(): string | null;
  getTraits(): Traits | null;
  setTraits(newTraits: Traits): void | Promise<void>;
  getExternalIds(): ExternalIds | null;
  load(): Promise<void>;
}

export class UserImpl implements User {
  private stores: StoresGroup;
  private anonymousId: string;
  private userId: string;
  private externalIds: ExternalIds;
  private traits: Traits = {};
  private readonly phoneCountryCode?: string;
  private readonly cookieService: HttpCookieService;
  private readonly sentry: SentryWrapper;

  public constructor(
    stores: StoresGroup,
    sentry: SentryWrapper,
    cookiesService?: HttpCookieService,
    phoneCountryCode?: string
  ) {
    this.stores = stores;
    this.sentry = sentry;
    this.cookieService = cookiesService;
    this.phoneCountryCode = phoneCountryCode;
  }

  public async load() {
    await this.initAnonymousId();
    await this.initUserId();
    this.initTraits();
    this.initExternalIds();
  }

  public async identify(
    userId: string,
    traits: Traits = {},
    externalIds?: ExternalIds
  ): Promise<void> {
    if (userId && userId != this.userId) {
      if (this.userId) {
        this.clearUserData();
      }
      await this.setUserId(userId);
      await this.syncAndSetServerCookies();
    }

    await this.setTraits(traits);

    if (externalIds) {
      await this.setExternalIds(externalIds);
    }
  }

  public getUserId(): string | null {
    return this.userId;
  }

  public getAnonymousId(): string | null {
    return this.anonymousId;
  }

  public getTraits(): Traits | null {
    return this.traits;
  }

  public getExternalIds(): ExternalIds | null {
    return this.externalIds;
  }
  private async syncAndSetServerCookies() {
    try {
      if (!this.cookieService) return;
      const httpCookies = await this.cookieService.dispatchRenew();
      if (httpCookies.anonymousId) {
        this.anonymousId = httpCookies.anonymousId;
        this.stores.set(ANONYMOUS_ID_PERSISTENCE_KEY, this.anonymousId);
      }
      if (httpCookies.userId) {
        this.userId = httpCookies.userId;
        this.stores.set(USER_ID_PERSISTENCE_KEY, this.userId);
      }
    } catch (err) {
      this.sentry.captureException(err);
      console.error(err);
    }
  }
  private clearUserData() {
    this.anonymousId = null;
    this.userId = null;
    this.externalIds = null;
    this.traits = null;
    this.stores.remove(ANONYMOUS_ID_PERSISTENCE_KEY);
    this.stores.remove(USER_ID_PERSISTENCE_KEY);
    this.stores.remove(EXTERNAL_IDs_PERSISTENCE_KEY);
    this.stores.remove(USER_TRAITS_PERSISTENCE_KEY);
  }

  private async initUserId() {
    this.userId = this.stores.get(USER_ID_PERSISTENCE_KEY);
    if (this.userId) {
      await this.setUserId(this.userId);
    }
  }

  private async initAnonymousId() {
    this.anonymousId = this.stores.get(ANONYMOUS_ID_PERSISTENCE_KEY);
    let newlyGenerated = false;
    if (!this.anonymousId) {
      this.anonymousId = uuid();
      newlyGenerated = true;
    }

    this.stores.set(ANONYMOUS_ID_PERSISTENCE_KEY, this.anonymousId);

    if (newlyGenerated) {
      // Only when anonymousId is generated, sync with server cookies
      await this.syncAndSetServerCookies();
    }
  }

  private async initExternalIds() {
    // get externalIds from one of the stores
    this.externalIds = this.stores.get(EXTERNAL_IDs_PERSISTENCE_KEY);
    if (this.externalIds) {
      // set externalIds on all stores
      await this.setExternalIds(this.externalIds);
    }
  }

  private async initTraits(): Promise<void> {
    const traits = this.stores.get(USER_TRAITS_PERSISTENCE_KEY);
    await this.setTraits(traits as Traits);
  }

  public async setTraits(newTraits: Traits): Promise<void> {
    this.traits = {
      ...this.traits,
      ...newTraits,
    };

    this.formatPhone();
    this.stores.set(USER_TRAITS_PERSISTENCE_KEY, this.traits);
  }

  private formatPhone() {
    if (this.phoneCountryCode?.length > 0 && this.traits.phone?.length > 0) {
      this.traits.phone = normalizePhone(
        this.traits.phone,
        this.phoneCountryCode
      );
    }
  }

  private async setUserId(userId: string) {
    this.userId = parseNumberToString(userId);
    this.stores.set(USER_ID_PERSISTENCE_KEY, this.userId);
  }

  private async setExternalIds(externalIds: ExternalIds): Promise<void> {
    this.externalIds = externalIds;
    this.stores.set(EXTERNAL_IDs_PERSISTENCE_KEY, externalIds);
  }
}
