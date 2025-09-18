import { Browser, InjectScriptOptions } from "../../lib/transport/browser";
import { UtmCampaign } from "../../lib/domain/event";

export class BrowserMock implements Browser {
  private nav: Navigator;
  private doc: Document;
  private loc: Location;
  private win: Window;
  private online: boolean;
  private canonPath: string;
  private canonUrl: string;
  private campaign: UtmCampaign | undefined;
  private isCurrentPageHttpsValue: boolean;
  private injectScriptFn: (url: string, opts: InjectScriptOptions) => void;
  private scriptAlreadyInPageFn: (scriptUrl: string) => boolean;

  injectScript(url: string, opts: InjectScriptOptions): void {
    return this.injectScriptFn(url, opts);
  }

  public scriptAlreadyInPage(scriptUrl: string): boolean {
    return this.scriptAlreadyInPageFn(scriptUrl);
  }

  isCurrentPageHttps(): boolean {
    return this.isCurrentPageHttpsValue;
  }

  navigator(): Navigator {
    return this.nav;
  }

  document(): Document {
    return this.doc;
  }

  location(): Location {
    return this.loc;
  }

  window(): Window {
    return this.win;
  }

  canonicalPath(): string {
    return this.canonPath;
  }

  canonicalUrl(): string {
    return this.canonUrl;
  }

  isOnline(): boolean {
    return this.online;
  }

  utmCampaign(): UtmCampaign | undefined {
    return this.campaign;
  }

  setInjectScriptFn(
    fn: (url: string, opts: InjectScriptOptions) => void
  ): void {
    this.injectScriptFn = fn;
  }

  setScriptAlreadyInPageFn(fn: (scriptUrl: string) => boolean): void {
    this.scriptAlreadyInPageFn = fn;
  }

  setIsCurrentPageHttps(value: boolean): void {
    this.isCurrentPageHttpsValue = value;
  }

  setNavigator(nav: Navigator): void {
    this.nav = nav;
  }

  setDocument(doc: Document): void {
    this.doc = doc;
  }

  setLocation(loc: Location): void {
    this.loc = loc;
  }

  setWindow(win: Window): void {
    this.win = win;
  }

  setOnline(online: boolean): void {
    this.online = online;
  }

  setCanonicalPath(canonPath: string): void {
    this.canonPath = canonPath;
  }

  setCanonicalUrl(canonUrl: string): void {
    this.canonUrl = canonUrl;
  }

  setCampaign(campaign: UtmCampaign | undefined): void {
    this.campaign = campaign;
  }
}
