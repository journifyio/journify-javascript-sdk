import { v4 as uuid } from "uuid";
import { JournifyEvent } from "../domain/event";
import { WithId } from "../lib/priorityQueue";

export interface Context extends WithId {
  getEvent(): JournifyEvent;
  getPluginName(): string;
  isSame(other: Context): boolean;
  setFailedDelivery(failedDelivery: ContextFailedDelivery): void;
  getFailedDelivery(): ContextFailedDelivery | null;
}

export interface ContextFactory {
  newContext(event: JournifyEvent, id?: string, pluginName?: string): Context;
}

export class ContextFactoryImpl implements ContextFactory {
  newContext(event: JournifyEvent, id?: string, pluginName?: string): Context {
    return new ContextImpl(event, id, pluginName);
  }
}

class ContextImpl implements Context {
  private readonly event: JournifyEvent;
  private readonly id: string;
  private readonly pluginName: string;
  private failedDelivery?: ContextFailedDelivery;

  public constructor(event: JournifyEvent, id?: string, pluginName?: string) {
    this.event = event;
    this.id = id ?? uuid();
    this.pluginName = pluginName;
  }

  public getEvent(): JournifyEvent {
    return this.event;
  }

  public getId(): string {
    return this.id;
  }

  public getPluginName(): string {
    return this.pluginName;
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
