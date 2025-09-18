import { User } from "../../lib/domain/user";
import { Traits } from "../../lib/domain/traits";
import { ExternalIds } from "../../lib/domain/externalId";

export class UserMock implements User {
  private anonymousId: string | null;
  private userId: string | null;
  private traits: Traits | null;
  private externalIds: ExternalIds | null;
  public funcs: UserMockFuncs | null;

  public constructor(
    userId?: string,
    anonymousId?: string,
    traits?: Traits,
    externalIds?: ExternalIds,
    funcs?: UserMockFuncs
  ) {
    this.userId = userId || null;
    this.anonymousId = anonymousId || null;
    this.traits = traits || null;
    this.externalIds = externalIds || null;
    this.funcs = funcs || null;
  }

  public async identify(
    userId?: string,
    traits: Traits = {},
    externalIds: ExternalIds = {}
  ): Promise<void> {
    if (this.funcs?.identify) {
      this.funcs?.identify(userId, traits, externalIds);
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

  public setUserId(userId: string) {
    this.userId = userId;
  }

  public setAnonymousId(anonymousId: string) {
    this.anonymousId = anonymousId;
  }

  public setTraits(traits: Traits) {
    this.traits = traits;
  }

  public setExternalIds(externalIds: ExternalIds) {
    this.externalIds = externalIds;
  }
  public async load(): Promise<void> {
    return Promise.resolve();
  }
}

export interface UserMockFuncs {
  identify?: jest.Func;
}
