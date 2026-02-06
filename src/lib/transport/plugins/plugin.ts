/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Context } from "../context";
import { Browser } from "../browser";
import { EventMapperFactory } from "./lib/eventMapping";
import { FieldsMapperFactory } from "./lib/fieldMapping";
import { HttpCookieOptions } from "../../lib/httpCookieService";
import { User } from "../../domain/user";
import { SentryWrapper } from "../../lib/sentry";
import {CategoryPreferences} from "../../domain/consent";

export interface Plugin {
  name: string;
  identify: (ctx: Context) => Promise<Context> | Context;
  track: (ctx: Context) => Promise<Context> | Context;
  page: (ctx: Context) => Promise<Context> | Context;
  group: (ctx: Context) => Promise<Context> | Context;
  updateSettings(settings: PluginSettings): void;
}

export interface PluginDependencies<T = undefined> {
  sync: Sync;
  user: User;
  fieldMapperFactory: FieldsMapperFactory;
  eventMapperFactory: EventMapperFactory;
  browser: Browser;
  testingWriteKey: boolean;
  logger: Logger;
  enableHashing?: boolean | false;
  externalSDK?: T;
  sentry: SentryWrapper;
}

export interface Logger {
  log: (...args: any[]) => void;
}

export type PluginSettings = SdkSettings | Sync;

type SdkOptions = {
  enableHashing?: boolean | false;
  sessionDurationMin?: number;
  cookie?: {
    domain?: string;
  };
  autoCapturePII?: boolean;
  autoCapturePhoneRegex?: string;
  phoneCountryCode?: string;
  httpCookieServiceOptions?: HttpCookieOptions;
  initialConsent?: CategoryPreferences;
};

export interface SdkSettings {
  writeKey: string;
  cdnHost?: string;
  apiHost?: string;
  options?: SdkOptions;
}

export interface WriteKeySettings {
  syncs: Sync[];
  countryCode?: string;
}

export interface Sync {
  id: string;
  destination_app: string;
  destination_consent_categories?: string[];
  settings: SyncSetting[];
  field_mappings: FieldMapping[];
  event_mappings: EventMapping[];
}

export interface SyncSetting {
  key: string;
  value: string;
}

export interface EventMapping {
  enabled: boolean;
  destination_event_key: string;
  event_type: TrackingEventType;
  event_name?: string;
  filters?: EventFilter[];
}

export enum TrackingEventType {
  UNDEFINED = "",
  TRACK_EVENT = "track",
  PAGE_EVENT = "page",
  SCREEN_EVENT = "screen",
  IDENTIFY_EVENT = "identify",
  GROUP_EVENT = "group",
}

export interface FieldMapping {
  source: FieldMappingSource;
  target: FieldMappingTarget;
}

export interface FieldMappingSource {
  type: FieldMappingSourceType;
  value: string;
}

export enum FieldMappingSourceType {
  UNSPECIFIED = 0,
  FIELD = 1,
  TEMPLATE = 2,
  CONSTANT = 3,
  VARIABLE = 4,
}

export interface FieldMappingTarget {
  name: string;
}

export interface EventFilter {
  field: string;
  operator: FilterOperator;
  value: any;
}

export enum FilterOperator {
  UNSPECIFIED = "",
  EQUALS = "==",
  NOT_EQUALS = "!=",
  CONTAINS = "contains",
  NOT_CONTAINS = "not contains",
  STARTS_WITH = "starts-with",
  ENDS_WITH = "ends-with",
  GREATER_THAN = ">",
  GREATER_THAN_OR_EQ = ">=",
  LESS_THAN = "<",
  LESS_THAN_OR_EQ = "<=",
}

export interface PixelEventMapping {
  pixelEventName: string;
  filters: EventFilter[];
}
