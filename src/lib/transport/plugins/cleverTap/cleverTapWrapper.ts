/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Browser } from "../../browser";
import { Logger } from "../plugin";

declare global {
  interface Window {
    clevertap: CleverTapObject;
  }
}

interface CleverTapObject {
  account: any[];
  event: any[];
  profile: any[];
  onUserLogin: any[];
  notifications: any[];
  privacy: any[];
}

export interface CleverTapWrapper {
  init: (accountId: string, region?: Region) => void;
  pushProfileData: (...profileData: ProfileData[]) => void;
  pushEvent(evtName: string, ...evtNameOrData: EventNameOrData[]): void;
}

type Region = "sg1" | "in1" | "us1" | "aps3" | "mec1";

export interface ProfileData {
  Site?: SiteData;
  Facebook?: object;
  "Google Plus"?: object;
}

export interface SiteData {
  Name?: string;
  Identity?: string | number;
  Gender?: "M" | "F";
  Employed?: "Y" | "N";
  Married?: "Y" | "N";
  Education?: "School" | "College" | "Graduate";
  Age?: string | number;
  DOB?: string | number | Date;
  Phone?: string | number;
  [key: string]: any;
}

type EventName = string;
type EventData = object;
type EventNameOrData = EventName | EventData;

export class CleverTapWrapperImpl implements CleverTapWrapper {
  private readonly browser: Browser;
  private readonly logger: Logger;
  private readonly testingMode: boolean;
  private scriptInitialized = false;

  constructor(browser: Browser, logger: Logger, testingWriteKey: boolean) {
    this.browser = browser;
    this.logger = logger;
    this.testingMode = testingWriteKey;
  }

  init(accountId: string, region?: Region): void {
    this.scriptInitialized = false;
    this.initScript();
    if (this.testingMode) {
      this.logger.log(
        `clevertap.account.push is called with: accountID: ${accountId}, region: ${region}`
      );
    } else {
      const clevertap = this.getCleverTapObject();
      clevertap.account.push({ id: accountId }, region);
    }
  }

  pushProfileData(profileData: ProfileData): void {
    this.initScript();
    if (this.testingMode) {
      this.logger.log(
        "Will call clevertap.onUserLogin.push with the following param:",
        profileData
      );
      return;
    }

    const clevertap = this.getCleverTapObject();
    clevertap.onUserLogin.push(profileData);
  }

  pushEvent(evtName: string, ...evtNameOrData: EventNameOrData[]): void {
    this.initScript();
    if (this.testingMode) {
      this.logger.log(
        "Will call clevertap.event.push with the following params in order:",
        [evtName, ...evtNameOrData]
      );
      return;
    }

    const clevertap = this.getCleverTapObject();
    clevertap.event.push(evtName, ...evtNameOrData);
  }

  private initScript(): void {
    if (this.scriptInitialized) {
      return;
    } else if (this.testingMode) {
      this.logger.log(
        "CleverTap is detected but script is not injected because you are using a testing write key."
      );
      this.scriptInitialized = true;
      return;
    }

    const win = this.browser.window();
    win.clevertap = {
      account: [],
      event: [],
      profile: [],
      onUserLogin: [],
      notifications: [],
      privacy: [],
    };

    const isHttps = this.browser.isCurrentPageHttps();
    const scriptHost = isHttps
      ? "https://d2r1yp2w7bby2u.cloudfront.net"
      : "http://static.clevertap.com";
    const scriptUrl = scriptHost + "/js/clevertap.min.js";
    this.browser.injectScript(scriptUrl, { async: true });

    this.scriptInitialized = true;
  }

  private getCleverTapObject(): CleverTapObject {
    return this.browser.window().clevertap;
  }
}
