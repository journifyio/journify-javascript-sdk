import { EventFactory } from "../../lib/transport/eventFactory";
import { JournifyEvent } from "../../lib/domain/event";
import { User } from "../../lib/domain/user";
import { Group } from "../../lib/domain/group";

export class EventFactoryMock implements EventFactory {
  public funcs: EventFactoryFuncs;
  private user: User;
  private group: Group;

  public constructor(funcs: EventFactoryFuncs) {
    this.funcs = funcs;
  }

  public setUser(user: User) {
    this.user = user;
  }

  public setGroup(group: Group) {
    this.group = group;
  }

  public newIdentifyEvent(): Promise<JournifyEvent> {
    return this.funcs?.newIdentifyEvent(this.user);
  }

  public newTrackEvent(
    eventName: string,
    properties?: JournifyEvent["properties"]
  ): Promise<JournifyEvent> {
    return this.funcs?.newTrackEvent(eventName, properties);
  }

  public newPageEvent(
    eventName: string,
    properties?: JournifyEvent["properties"]
  ): Promise<JournifyEvent> {
    return this.funcs?.newPageEvent(eventName, properties);
  }

  public newGroupEvent(): Promise<JournifyEvent> {
    return this.funcs?.newGroupEvent();
  }
}

export interface EventFactoryFuncs {
  newIdentifyEvent?: jest.Func;
  newTrackEvent?: jest.Func;
  newPageEvent?: jest.Func;
  newGroupEvent?: jest.Func;
}
