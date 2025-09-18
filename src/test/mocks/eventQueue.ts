import { EventQueue } from "../../lib/transport/queue";
import { Context } from "../../lib/transport/context";

export class EventQueueMock implements EventQueue {
  public funcs: EventQueueMockFuncs;
  public constructor(funcs: EventQueueMockFuncs) {
    this.funcs = funcs;
  }

  deliver(ctx: Context): Promise<Context> {
    if (this.funcs.deliver) {
      return this.funcs.deliver(ctx);
    }

    return Promise.resolve(undefined);
  }
}

export interface EventQueueMockFuncs {
  deliver?: jest.Func;
}
