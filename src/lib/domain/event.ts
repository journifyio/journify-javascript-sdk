import { JSONValue, Traits } from "./traits";
import { ExternalIds } from "./externalId";

export interface JournifyEvent {
  messageId?: string;
  type: JournifyEventType;
  externalIds?: ExternalIds;
  userId?: string;
  anonymousId?: string;
  event?: string;
  name?: string;
  traits?: Traits;
  timestamp?: Date | string;
  context?: EventContext;
  session?: Session;
  properties?: object & {
    [k: string]: JSONValue;
  };
}

export enum JournifyEventType {
  TRACK = "track",
  PAGE = "page",
  IDENTIFY = "identify",
  GROUP = "group",
}

export enum JournifyDefaultEvent {
  PAGE = "PAGE_EVENT_KEY",
  IDENTIFY = "IDENTIFY_EVENT_KEY",
  GROUP = "GROUP_EVENT_KEY",
}

export interface UtmCampaign {
  id?: string;
  name?: string;
  source?: string;
  medium?: string;
  term?: string;
  content?: string;
}

interface EventContext {
  userAgent?: string;
  library?: {
    name: string;
    version: string;
  };
  locale?: string;
  page?: Page;
  campaign?: UtmCampaign;
  groupId?: string;
  [key: string]: unknown;
}

interface Page {
  path?: string;
  referrer?: string;
  search?: string;
  title?: string;
  url?: string;
}

interface Session {
  id?: string;
}
