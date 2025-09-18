import { Plugin, SdkSettings } from "../plugin";
import { Context } from "../../context";
import { hashPII } from "../lib/hashPII";
import { SentryWrapper } from "../../../lib/sentry";

const DEFAULT_API_HOST = "https://t.journify.io";
// this is used to limit the size of the request body to prevent issues with large payloads
const MAX_REQUEST_BODY_SIZE_KB = 16; // 16KB

export class JournifyioPlugin implements Plugin {
  public readonly name = "journifyio";
  private sdkSettings: SdkSettings;
  private sentry: SentryWrapper;

  public constructor(sdkConfig: SdkSettings, sentry: SentryWrapper) {
    this.sdkSettings = sdkConfig;
    this.sentry = sentry;
  }

  public updateSettings(settings: SdkSettings) {
    this.sdkSettings = settings;
  }

  public identify = this.post;
  public track = this.post;
  public page = this.post;
  public group = this.post;
  private async post(ctx: Context): Promise<Context> {
    const apiHost = this.sdkSettings.apiHost ?? DEFAULT_API_HOST;
    const event = ctx.getEvent();

    if (this.sdkSettings?.options?.enableHashing === true) {
      event.traits = await hashPII(event.traits);
      event.externalIds = await hashPII(event.externalIds);
    }

    if (event.traits?.hashed_email && !event.traits.email) {
      event.traits.email = event.traits.hashed_email as string;
      delete event.traits.hashed_email;
    }

    if (event.traits?.hashed_phone && !event.traits.phone) {
      event.traits.phone = event.traits.hashed_phone as string;
      delete event.traits.hashed_phone;
    }

    const eventUrl = `${apiHost}/v1/${event.type?.charAt(0)}`;
    const requestBody = {
      ...event,
      writeKey: this.sdkSettings.writeKey,
    };
    const requestBodyStr = JSON.stringify(requestBody);
    const requestBodyBytes = new TextEncoder().encode(requestBodyStr).length;
    if (requestBodyBytes > MAX_REQUEST_BODY_SIZE_KB * 1024) {
      throw new Error(
        `Your event is ignored because the request body exceeds ${MAX_REQUEST_BODY_SIZE_KB}Kb limit.`
      );
    }

    this.sentry.setTag("eventUrl", eventUrl);
    this.sentry.setTag("writeKey", requestBody.writeKey);
    const response = await fetch(eventUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBodyStr,
      keepalive: true,
    });

    if (!response.ok) {
      this.sentry.setResponse({
        url: eventUrl,
        headers: response.headers,
        status: response.status,
        body: await response.text(),
      });
      // Only throw error if it's 5xx (server errors) error to retry
      if (response.status >= 500) {
        throw new Error(
          `POST request to ${eventUrl} returned ${response.status} HTTP status`
        );
      }
    }

    return ctx;
  }
}
