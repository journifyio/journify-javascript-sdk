import * as Sentry from "@sentry/browser";
import { LIB_VERSION } from "../generated/libVersion";
import type { Primitive } from "@sentry/types";
import type { SeverityLevel } from "@sentry/types";
import type { EventHint } from "@sentry/types";

const isLocalHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "lvh.me";

export interface SentryWrapper {
  setTag(key: string, value: Primitive): void;
  setResponse(response: SimpleResponse): Promise<void>;
  captureMessage(
    message: string,
    level?: SeverityLevel,
    hint?: EventHint
  ): string;
  captureException(error: unknown, hint?: EventHint): string;
}

export type SimpleResponse = {
  url: string;
  headers: Headers;
  status: number;
  body: string;
};

export class SentryWrapperImpl implements SentryWrapper {
  private readonly scope: Sentry.Scope;
  constructor() {
    const integrations = Sentry.getDefaultIntegrations({})
      .filter((defaultIntegration) => {
        return ![
          "BrowserApiErrors",
          "TryCatch",
          "Breadcrumbs",
          "GlobalHandlers",
        ].includes(defaultIntegration.name);
      })
      .concat([Sentry.browserProfilingIntegration()]);

    const client = new Sentry.BrowserClient({
      enabled: !isLocalHost,
      release: LIB_VERSION,
      dsn: "https://11576b3befe62387b6f5ad58d9bd738f@o4506150022152192.ingest.us.sentry.io/4507033659375616",
      sampleRate: 0.001,
      tracesSampleRate: 0.001,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.2,
      transport: Sentry.makeFetchTransport,
      stackParser: Sentry.defaultStackParser,
      integrations: integrations,
      ignoreErrors: [
        "SecurityError",
        "the user id is required when calling identify",
        "TypeError: Failed to fetch",
        "TypeError: Load failed",
        "TypeError: NetworkError when attempting to fetch resource.",
      ],
    });

    this.scope = new Sentry.Scope();
    this.scope.setClient(client);
    this.scope.setTag("domain", window.location.hostname);

    client.init();
  }

  captureMessage(
    message: string,
    level?: SeverityLevel,
    hint?: EventHint
  ): string {
    return this.scope.captureMessage(message, level, hint);
  }

  captureException(error: unknown, hint?: EventHint): string {
    return this.scope.captureException(error, hint);
  }

  setResponse(response: SimpleResponse): Promise<void> {
    if (!response) {
      return;
    }
    this.scope.setExtra("response", response);
  }

  setTag(key: string, value: Primitive): void {
    this.scope.setTag(key, value);
  }
}
