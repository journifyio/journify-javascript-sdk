import { Context, ContextFactory } from "../transport/context";
import { EmitterImpl } from "../transport/emitter";
import { Traits } from "../domain/traits";
import { User } from "../domain/user";
import { EventFactory } from "../transport/eventFactory";
import { JournifyEvent } from "../domain/event";
import { EventQueue } from "../transport/queue";
import { Group, GroupFactory } from "../domain/group";
import { SdkSettings } from "../transport/plugins/plugin";
import { ExternalIds } from "../domain/externalId";

const IDENTIFY_EVENT_NAME = "identify";
const TRACK_EVENT_NAME = "track";
const PAGE_EVENT_NAME = "page";
const GROUP_EVENT_NAME = "group";

export interface SdkDependencies {
  user: User;
  groupFactory: GroupFactory;
  eventFactory: EventFactory;
  contextFactory: ContextFactory;
  eventQueue: EventQueue;
}

export class Sdk extends EmitterImpl {
  private readonly sdkSettings: SdkSettings;
  private readonly _group: Group;
  private readonly user: User;
  private readonly eventFactory: EventFactory;
  private readonly contextFactory: ContextFactory;
  private readonly eventQueue: EventQueue;

  public constructor(sdkSettings: SdkSettings, deps: SdkDependencies) {
    super();

    this.sdkSettings = sdkSettings;
    this.contextFactory = deps.contextFactory;
    this.eventQueue = deps.eventQueue;
    this.eventFactory = deps.eventFactory;

    this.user = deps.user;
    this.eventFactory.setUser(this.user);

    this._group = deps.groupFactory.loadGroup();
    this.eventFactory.setGroup(this._group);
  }

  public async identify(
    userId: string,
    traits?: Traits,
    externalIds?: ExternalIds
  ): Promise<Context> {
    await this.user.identify(userId, traits, externalIds);
    const event = await this.eventFactory.newIdentifyEvent();
    const ctx = await this.dispatchEvent(event);
    const ctxEvent = ctx.getEvent();

    this.emit(IDENTIFY_EVENT_NAME, ctxEvent.userId, ctxEvent.traits);
    return ctx;
  }

  public async track(
    eventName: string,
    properties?: object,
    traits?: object
  ): Promise<Context> {
    if (isNonValidString(eventName)) {
      throw new Error("Event name is missing");
    }

    const event = await this.eventFactory.newTrackEvent(
      eventName,
      properties as JournifyEvent["properties"],
      traits as JournifyEvent["traits"]
    );

    const ctx = await this.dispatchEvent(event);
    const ctxEvent = ctx.getEvent();
    this.emit(
      TRACK_EVENT_NAME,
      ctxEvent.event,
      ctxEvent.properties,
      ctxEvent.traits
    );

    return ctx;
  }

  public async page(
    pageNameParam?: string,
    properties?: object,
    traits?: object
  ): Promise<Context> {
    let pageName: string = pageNameParam;
    if (isNonValidString(pageName)) {
      pageName = document.title;
    }

    const event = await this.eventFactory.newPageEvent(
      pageName,
      properties as JournifyEvent["properties"],
      traits as JournifyEvent["traits"]
    );

    const ctx = await this.dispatchEvent(event);
    const ctxEvent = ctx.getEvent();
    this.emit(PAGE_EVENT_NAME, ctxEvent.event, ctxEvent.properties);

    return ctx;
  }

  public async group(groupId: string, traits?: Traits) {
    this._group.identify(groupId, traits);
    const event = await this.eventFactory.newGroupEvent();
    const ctx = await this.dispatchEvent(event);
    const ctxEvent = ctx.getEvent();
    this.emit(GROUP_EVENT_NAME, ctxEvent.context.groupId, ctxEvent.traits);
    return ctx;
  }

  private async dispatchEvent(event: JournifyEvent): Promise<Context> {
    const eventCtx = this.contextFactory.newContext(event);
    return this.eventQueue.deliver(eventCtx);
  }
}

function isNonValidString(str: string): boolean {
  return !str || typeof str !== "string" || str.trim().length === 0;
}
