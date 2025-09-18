import JsCookie from "js-cookie";

import { Store } from "./store";

const ONE_YEAR = 365;

export class CookiesStore implements Store {
  private attributes: JsCookie.CookieAttributes;
  private readonly domain?: string;

  public constructor(domain?: string) {
    this.domain = domain;
  }

  public static isAvailable(): boolean {
    let cookieEnabled = navigator?.cookieEnabled;

    if (!cookieEnabled) {
      const testKey = "journify.io-test-cookie-key";
      JsCookie.set(testKey, "journify.io-test-cookie-value");
      cookieEnabled = document.cookie.includes(testKey);
      JsCookie.remove(testKey);
    }

    return cookieEnabled;
  }

  public get<T>(key: string): T | null {
    try {
      const value = JsCookie.get(key);

      if (!value) {
        return null;
      }

      try {
        return JSON.parse(value);
      } catch (e) {
        return value as unknown as T;
      }
    } catch (e) {
      return null;
    }
  }

  public set<T>(key: string, value: T): T | null {
    const attributes = this.getAttributes();

    if (value === null || value === undefined || value === "") {
      JsCookie.remove(key, attributes);
      return null;
    }
    let parsedValue = "";
    switch (typeof value) {
      case "string":
        parsedValue = value;
        break;
      case "number":
      case "boolean":
        parsedValue = value.toString();
        break;
      default:
        parsedValue = JSON.stringify(value);
    }
    JsCookie.set(key, parsedValue, attributes);
    return value;
  }

  public remove(key: string): void {
    return JsCookie.remove(key, this.getAttributes());
  }

  private getAttributes(): JsCookie.CookieAttributes {
    if (!this.attributes) {
      this.setAttributes();
    }

    return this.attributes;
  }

  private setAttributes() {
    this.attributes = {
      expires: ONE_YEAR,
      path: "/",
      domain: this.getDomainAttribute(),
      sameSite: "Lax",
    };
  }

  private getDomainAttribute(): string | undefined {
    if (this.domain) {
      return this.domain;
    }

    const parsedUrl = parseUrl(location?.href);
    if (!parsedUrl) return;
    const levels = getUrlLevels(parsedUrl);

    // Lookup the real top level one.
    for (let i = 0; i < levels.length; ++i) {
      const cname = "__tld__";
      const domain = levels[i];
      const opts = { domain: "." + domain };

      try {
        // cookie access throw an error if the library is run inside a sandboxed environment (e.g. sandboxed iframe)
        JsCookie.set(cname, "1", opts);
        if (JsCookie.get(cname)) {
          JsCookie.remove(cname, opts);
          return domain;
        }
      } catch (_) {
        return;
      }
    }
  }
}

function parseUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return;
  }
}

function getUrlLevels(url: URL): string[] {
  const host = url.hostname;
  const parts = host.split(".");
  const last = parts[parts.length - 1];
  const levels: string[] = [];

  // Ip address.
  if (parts.length === 4 && parseInt(last, 10) > 0) {
    return levels;
  }

  // Localhost.
  if (parts.length <= 1) {
    return levels;
  }

  // Create levels.
  for (let i = parts.length - 2; i >= 0; --i) {
    levels.push(parts.slice(i).join("."));
  }

  return levels;
}
