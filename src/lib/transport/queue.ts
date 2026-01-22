import { Context, ContextFactory, ContextFactoryImpl } from "./context";
import {
  ON_OPERATION_DELAY_FINISH,
  OperationsPriorityQueue,
} from "../lib/priorityQueue";
import { EmitterImpl } from "./emitter";
import { Plugin } from "./plugins/plugin";
import { Browser } from "./browser";
import { SentryWrapper } from "../lib/sentry";

const FLUSH_EVENT_NAME = "flush";

export interface EventQueue {
  deliver(ctx: Context): Promise<Context>;
}

export class EventQueueImpl extends EmitterImpl implements EventQueue {
  private pQueue: OperationsPriorityQueue<Context>;
  private readonly plugins: Plugin[] = [];
  private flushing = false;
  private readonly browser: Browser;
  private readonly contextFactory: ContextFactory;
  private readonly sentry: SentryWrapper;

  public constructor(
    plugins: Plugin[],
    pQueue: OperationsPriorityQueue<Context>,
    browser: Browser,
    sentry: SentryWrapper,
    contextFactory: ContextFactory = new ContextFactoryImpl()
  ) {
    super();
    this.plugins = plugins;
    this.pQueue = pQueue;
    this.pQueue.on(ON_OPERATION_DELAY_FINISH, async () => {
      try {
        await this.flush();
      } catch (error) {
        this.sentry.captureException(error);
        console.error(error);
      }
    });
    this.browser = browser;
    this.sentry = sentry;
    this.contextFactory = contextFactory;
  }

  private push(ctx: Context): Context[] {
    const updatedContextEvents = this.plugins.map((p) => {
      const newId = generateNewIDWithPlugin(ctx.getId(), p.name);
      return this.contextFactory.newContext(ctx.getEvent(), newId, p.name);
    });
    this.pQueue.push(...updatedContextEvents);
    return updatedContextEvents;
  }

  public async deliver(ctx: Context): Promise<Context> {
    const updatedContexts = this.push(ctx);

    for (const c of updatedContexts) {
      this.subscribeToDelivery(c);
      this.flush();
    }

    return ctx;
  }

  private subscribeToDelivery(sentCtx: Context) {
    this.on(FLUSH_EVENT_NAME, (flushedCtx: Context, delivered: boolean) => {
      if (!flushedCtx.isSame(sentCtx) || delivered) {
        return;
      }

      const failureReason = flushedCtx.getFailedDelivery()?.reason;
      this.sentry.captureException(failureReason);
      console.error(failureReason);
    });
  }

  private async flush(): Promise<void> {
    while (this.flushing);
    this.flushing = true;

    if (this.pQueue.isEmpty() || !this.browser.isOnline()) {
      this.flushing = false;
      return;
    }

    const ctxToDeliver: Context = this.pQueue.pop();
    this.flushing = false;

    if (!ctxToDeliver) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
          const eventPlugins = this.plugins.filter((p) =>
              ctxToDeliver.getPluginName() == p.name
          );
          if (!eventPlugins || eventPlugins.length === 0) {
              this.sentry.captureMessage(
                  "unable to find a plugin for given event",
                  null,
                  {
                      data: {
                          event: ctxToDeliver,
                      },
                  }
              );
              resolve();
              return;
          }

          const attempts: Promise<void>[] = [];
          for (const p of eventPlugins) {
            attempts.push(this.attempt(p, ctxToDeliver))
          }

          Promise.all(attempts).then(() => resolve()).catch(reject);
      }, 0);
    });
  }

  private async attempt(plugin: Plugin, ctxToDeliver: Context) {
    try {
      const deliveredCtx = await this.runPlugin(ctxToDeliver, plugin);
      this.emit(FLUSH_EVENT_NAME, deliveredCtx, true);
    } catch (err: unknown) {
      this.handleFlushError(ctxToDeliver, plugin, err);
    }
  }

  private async runPlugin(
    ctxToDeliver: Context,
    plugin: Plugin
  ): Promise<Context> {
    const event = ctxToDeliver.getEvent();
    if (!plugin || !plugin[event.type]) {
      return ctxToDeliver;
    }

    const hook = plugin[event.type];
    return hook.apply(plugin, [ctxToDeliver]);
  }

  private handleFlushError(
    ctxToDeliver: Context,
    plugin: Plugin,
    err: unknown
  ) {
    const retryAccepted = this.pQueue.pushWithBackoff(ctxToDeliver);
    if (!retryAccepted) {
      ctxToDeliver.setFailedDelivery({ reason: err });
      this.emit(FLUSH_EVENT_NAME, ctxToDeliver, false);
    }
  }
}

function generateNewIDWithPlugin(id: string, plugin: string): string {
  return `${id}/${plugin}`;
}