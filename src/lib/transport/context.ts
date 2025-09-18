import { v4 as uuid } from "uuid";
import { JournifyEvent } from "../domain/event";
import { WithId } from "../lib/priorityQueue";

export interface Context extends WithId {
  getEvent(): JournifyEvent;
  isSame(other: Context): boolean;
  setFailedDelivery(failedDelivery: ContextFailedDelivery): void;
  getFailedDelivery(): ContextFailedDelivery | null;
}

export interface ContextFactory {
  newContext(event: JournifyEvent, id?: string): Context;
}

export class ContextFactoryImpl implements ContextFactory {
  newContext(event: JournifyEvent, id?: string): Context {
    return new ContextImpl(event, id);
  }
}

class ContextImpl implements Context {
  private readonly event: JournifyEvent;
  private readonly id: string;
  private failedDelivery?: ContextFailedDelivery;

  public constructor(event: JournifyEvent, id?: string) {
    this.event = event;
    this.id = id ?? uuid();
  }

  public getEvent(): JournifyEvent {
    return this.event;
  }

  public getId(): string {
    return this.id;
  }

  public isSame(other: Context): boolean {
    return other.getId() === this.id;
  }

  public setFailedDelivery(failedDelivery: ContextFailedDelivery) {
    this.failedDelivery = failedDelivery;
  }

  public getFailedDelivery(): ContextFailedDelivery | null {
    return this.failedDelivery ?? null;
  }
}

export interface ContextFailedDelivery {
  reason: unknown;
}
