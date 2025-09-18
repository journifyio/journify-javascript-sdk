import { Browser } from "../transport/browser";
import { SentryWrapper } from "./sentry";
import { Store } from "../store/store";

export type HttpCookieOptions = {
  renewUrl: string;
  enablePolling?: boolean;
  pollingInterval?: number;
  backoff?: number;
  retries?: number;
  timeout?: number;
};

export type HttpCookieResponse = {
  anonymousId: string;
  userId?: string;
};

export interface HttpCookieService {
  dispatchRenew(): Promise<HttpCookieResponse>;
}

const supportedCookies = ["_ga"];
export class HttpCookieServiceImpl implements HttpCookieService {
  private renewUrl: string;

  private retries: number;
  private backoff: number;
  private timeout: number;
  private pollingInterval: number;
  private readonly sentry: SentryWrapper;

  private initialCookies: { [key: string]: string } = {};
  private cookiesStore: Store;
  constructor(
    options: HttpCookieOptions,
    browser: Browser,
    sentry: SentryWrapper,
    cookiesStore: Store
  ) {
    if (!options.renewUrl) {
      throw new Error("Missing required renewUrl option for HttpCookieService");
    }
    this.cookiesStore = cookiesStore;
    this.sentry = sentry;
    const origin = browser.location().origin;

    this.renewUrl = new URL(options.renewUrl, origin).href;
    this.backoff = options.backoff ?? 300;
    this.retries = options.retries ?? 2;
    this.timeout = options.timeout ?? 3000;
    this.pollingInterval = options.pollingInterval ?? 300;

    if (options.enablePolling) {
      // Gather initial cookies
      this.setInitialCookies();
      // Start polling for cookies changes (when GA4 is loaded and _ga cookie is set)
      this.pollingCookieKeeper(this.pollingInterval);
    }
  }
  private pollingCookieKeeper(timeout) {
    setTimeout(async () => {
      this.pollingCookieKeeper(timeout * 2); // Exponential backoff
      // If cookies have not changed, we don't need to do anything.
      if (!this.hasCookiesChanged()) {
        return;
      }
      // When cookies have changed, and we have initial cookies, we need to revert to initial cookies.
      if (!this.isInitialCookiesEmpty()) {
        this.revertInitialCookies();
        return;
      }
      // When cookies have changed, and we have no initial cookies, we need to persist the new cookies to the server.
      await this.dispatchRenew();
      this.setInitialCookies();
    }, timeout);
  }
  private revertInitialCookies() {
    supportedCookies.forEach((cookie) => {
      this.cookiesStore.set(cookie, this.initialCookies[cookie]);
    });
  }
  private isInitialCookiesEmpty() {
    return supportedCookies.every(
      (cookie) =>
        this.initialCookies[cookie] === null ||
        this.initialCookies[cookie] === undefined
    );
  }
  private hasCookiesChanged() {
    return supportedCookies.some((cookie) => {
      return this.initialCookies[cookie] !== this.cookiesStore.get(cookie);
    });
  }
  private setInitialCookies() {
    supportedCookies.forEach((cookie) => {
      this.initialCookies[cookie] = this.cookiesStore.get(cookie);
    });
  }
  private sendHTTPCookies(serviceUrl: string) {
    return async () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), this.timeout);
      const response = await fetch(serviceUrl, {
        signal: controller.signal,
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) {
        const err = new Error(
          `Failed to request HTTP Cookies, reason: ${response.statusText}`
        );
        await this.sentry.setResponse({
          url: serviceUrl,
          headers: response.headers,
          status: response.status,
          body: await response.text(),
        });
        throw err;
      }
      const data = await response.json();
      const httpCookie: HttpCookieResponse = {
        anonymousId: data?.journifyio_anonymous_id,
        userId: data?.journifyio_user_id,
      };
      return httpCookie;
    };
  }
  async dispatchRenew(): Promise<HttpCookieResponse> {
    return await retry(
      this.sendHTTPCookies(this.renewUrl),
      this.retries,
      this.backoff
    );
  }
}

async function sleep(delayMS: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMS));
}
async function retry<T>(
  req: () => Promise<T>,
  retries: number,
  backoff: number
): Promise<T> {
  while (retries >= 0) {
    try {
      return await req();
    } catch (error) {
      if (retries <= 0) throw error;
      retries -= 1;
      await sleep(backoff);
    }
  }
}
