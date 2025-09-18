import { JournifyEvent } from "../../lib/domain/event";
import {
  Context,
  ContextFactory,
  ContextFailedDelivery,
} from "../../lib/transport/context";

export class ContextMock implements Context {
  private readonly id: string;
  private readonly event: JournifyEvent;
  private failedDelivery: ContextFailedDelivery;

  constructor(
    id: string,
    event: JournifyEvent,
    failedDelivery?: ContextFailedDelivery
  ) {
    this.id = id;
    this.event = event;
    this.failedDelivery = failedDelivery;
  }

  getEvent(): JournifyEvent {
    return this.event;
  }

  getFailedDelivery(): ContextFailedDelivery {
    return this.failedDelivery;
  }

  getId(): string {
    return this.id;
  }

  isSame(other: Context): boolean {
    return this.getId() == other.getId();
  }

  setFailedDelivery(failedDelivery: ContextFailedDelivery) {
    this.failedDelivery = failedDelivery;
  }
}

export class ContextFactoryMock implements ContextFactory {
  public funcs: ContextFactoryFuncs;

  public constructor(funcs: ContextFactoryFuncs) {
    this.funcs = funcs;
  }

  public newContext(event: JournifyEvent, id?: string): Context {
    return this.funcs?.newContext(event, id);
  }
}

export interface ContextFactoryFuncs {
  newContext?: jest.Func;
}
