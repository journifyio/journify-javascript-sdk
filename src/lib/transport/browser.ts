import { Store } from "../store/store";
import { UtmCampaign } from "../domain/event";

export type InjectScriptOptions = {
  async: boolean;
  onload?: () => void;
};
export interface Browser {
  injectScript(url: string, opts: InjectScriptOptions): void;
  scriptAlreadyInPage(scriptUrl: string): boolean;
  isCurrentPageHttps(): boolean;
  navigator(): Navigator;
  document(): Document;
  location(): Location;
  window(): Window;
  isOnline(): boolean;
  canonicalPath(): string;
  canonicalUrl(): string;
  utmCampaign(queryString: string, store: Store): UtmCampaign | undefined;
}

export class BrowserImpl implements Browser {
  public injectScript(url: string, opts: InjectScriptOptions): void {
    const script = this.document().createElement("script");
    script.src = url;
    script.async = opts.async;
    script.onload = opts.onload;
    const doc = this.document();
    const scripts = doc.getElementsByTagName("script");
    if (scripts.length > 0) {
      scripts[0].parentNode?.insertBefore(script, null);
    } else {
      doc.head.appendChild(script);
    }
  }

  public scriptAlreadyInPage(scriptUrl: string): boolean {
    return Array.from(this.document().scripts).some((script) =>
      script.src.includes(scriptUrl)
    );
  }

  public isCurrentPageHttps(): boolean {
    return this.location()?.protocol === "https:";
  }

  public navigator(): Navigator {
    return navigator;
  }

  public document(): Document {
    return document;
  }

  public location(): Location {
    return location;
  }

  public window(): Window {
    return window;
  }

  public isOnline(): boolean {
    return this.navigator()?.onLine || false;
  }

  public canonicalPath(): string {
    const canon = this.canonical();
    if (!canon) {
      return this.location()?.pathname;
    }

    const a = this.document().createElement("a");
    a.href = canon;

    return !a.pathname.startsWith("/") ? "/" + a.pathname : a.pathname;
  }

  public canonicalUrl(): string {
    const canon = this.canonical();
    if (canon) {
      return canon.includes("?") ? canon : `${canon}${this.location()?.search}`;
    }

    const url = this.location()?.href;
    const i = url.indexOf("#");
    return i === -1 ? url : url.slice(0, i);
  }

  public utmCampaign(
    queryString: string,
    store: Store
  ): UtmCampaign | undefined {
    const utm: UtmCampaign = {};
    const sParams = new URLSearchParams(queryString);
    let campaignFound = false;

    UTM_KEYS.forEach((k) => {
      const paramName = k[0];
      const param = this.getUtmParam(paramName, sParams, store);
      if (param) {
        const fieldName = k[1];
        campaignFound = true;
        utm[fieldName] = param;
      }
    });

    return campaignFound ? utm : undefined;
  }

  private canonical(): string | null {
    const tag = this.document().querySelector("link[rel='canonical']");
    if (!tag) {
      return null;
    }

    return tag.getAttribute("href");
  }

  private getUtmParam(
    paramName: string,
    sParams: URLSearchParams,
    store: Store
  ): string | null {
    const value = sParams.get(paramName) || store.get<string>(paramName);
    if (!value) {
      return null;
    }
    store.set(paramName, value);
    return value.toString();
  }
}

export const UTM_KEYS: [string, keyof UtmCampaign][] = [
  ["utm_id", "id"],
  ["utm_campaign", "name"],
  ["utm_source", "source"],
  ["utm_medium", "medium"],
  ["utm_term", "term"],
  ["utm_content", "content"],
];
