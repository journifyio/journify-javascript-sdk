import {
  SdkSettings,
  WriteKeySettings,
  PluginSettings,
  PluginDependencies,
  Logger,
  Sync,
} from "../transport/plugins/plugin";
import { Sdk, SdkDependencies } from "./sdk";
import { NullStore } from "../store/nullStore";
import { CookiesStore } from "../store/cookiesStore";
import { MemoryStore } from "../store/memoryStore";
import { Plugin } from "../transport/plugins/plugin";
import { EventQueueImpl } from "../transport/queue";
import { User, UserImpl } from "../domain/user";
import { EventFactoryImpl } from "../transport/eventFactory";
import { Context, ContextFactoryImpl } from "../transport/context";
import { OperationsPriorityQueueImpl } from "../lib/priorityQueue";
import { GroupFactoryImpl } from "../domain/group";
import { SESSION_ID_PERSISTENCE_KEY, Store, StoresGroup } from "../store/store";
import { BrowserStore } from "../store/browserStore";
import { FacebookPixel } from "../transport/plugins/facebook/facebookPixel";
import { SnapchatPixel } from "../transport/plugins/snapchat/snapchatPixel";
import { BrowserImpl, UTM_KEYS } from "../transport/browser";
import { GA4Pixel } from "../transport/plugins/ga4_pixel/ga4Pixel";
import { TikTokPixel } from "../transport/plugins/tiktok/tiktokPixel";
import { CleverTapPlugin } from "../transport/plugins/cleverTap/cleverTapPlugin";
import { CleverTapWrapperImpl } from "../transport/plugins/cleverTap/cleverTapWrapper";
import { SessionStore } from "../store/sessionStore";
import { ExternalIdsSessionCacheImpl } from "../domain/externalId";
import { AutoCapturePII } from "../lib/autoCapturePII";
import { HttpCookieService, HttpCookieServiceImpl} from "../lib/httpCookieService";
import {PinterestTag} from "../transport/plugins/pinterest/pinterestTag";
import {JournifyioPlugin} from "../transport/plugins/journifyio/journifyio";
import {XPixel} from "../transport/plugins/x/xPixel";
import {SentryWrapper} from "../lib/sentry";
import {BingAdsTag} from "../transport/plugins/bing_ads_tag/bing_ads_tag";
import {GoogleAdsGtag} from "../transport/plugins/google_ads_gtag/googleAdsGtag";
import {LinkedinAdsInsightTag} from "../transport/plugins/linkedin_ads_insight_tag/linkedinAdsInsightTag";
import {FieldsMapperFactoryImpl} from "../transport/plugins/lib/fieldMapping";
import {EventMapperFactoryImpl} from "../transport/plugins/lib/eventMapping";
import {ConsentServiceImpl, ConsentService, CategoryPreferences} from "../domain/consent";

const INTEGRATION_PLUGINS = {
  bing_ads_tag: BingAdsTag,
  clevertap: CleverTapPlugin,
  facebook_pixel: FacebookPixel,
  ga4_pixel: GA4Pixel,
  google_ads_gtag: GoogleAdsGtag,
  linkedin_ads_insight_tag: LinkedinAdsInsightTag,
  pinterest_tag: PinterestTag,
  snapchat_pixel: SnapchatPixel,
  tiktok_pixel: TikTokPixel,
  x_pixel: XPixel,
};

const JOURNIFY_PREFIX = "[Journify]";

export class Loader {
  private readonly sentryWrapper: SentryWrapper;
  private sdk: Sdk = null;
  private user: User = null;
  private plugins: Record<string, Plugin> = {};
  private sessionIntervalId: NodeJS.Timeout = null;
  private stores: StoresGroup = null;
  private cookiesStore: Store = null;
  private sdkSettings: SdkSettings;
  private writeKeySettings: WriteKeySettings;
  private consentService: ConsentService = null;

  constructor(sentryWrapper: SentryWrapper) {
    this.sentryWrapper = sentryWrapper;
  }

  public async load(
      sdkConfig: SdkSettings,
      writeKeySettings: WriteKeySettings
  ): Promise<Sdk> {
    this.sdkSettings = sdkConfig;
    this.writeKeySettings = writeKeySettings;
    this.startNewSession();

    if (!this.consentService) {
      const initialConsent = sdkConfig.options?.initialConsent;
      this.consentService = new ConsentServiceImpl(
          writeKeySettings.countryCode,
          initialConsent
      );
    }

    const browser = new BrowserImpl();

    let cookieService: HttpCookieService;
    if (this.sdkSettings?.options?.httpCookieServiceOptions) {
      cookieService = new HttpCookieServiceImpl(
          this.sdkSettings?.options?.httpCookieServiceOptions,
          browser,
          this.sentryWrapper,
          this.cookiesStore
      );
    }
    this.user = new UserImpl(
        this.stores,
        this.sentryWrapper,
        cookieService,
        this.sdkSettings?.options?.phoneCountryCode
    );
    await this.user.load();

    if (!this.sdk) {
      this.initSdk();
    } else {
      this.updatePluginSettings();
    }

    return this.sdk;
  }

  private initSdk() {
    const sharedDeps = this.createSharedPluginDependencies();

    this.plugins = {
      journifyio: new JournifyioPlugin(this.sdkSettings, this.sentryWrapper),
    };

    for (const sync of this.writeKeySettings.syncs) {
      if (this.consentService.hasConsent(sync.destination_consent_categories)) {
        const plugin = this.createPlugin(sync, sharedDeps);
        if (plugin) {
          this.plugins[sync.id] = plugin;
        }
      }
    }

    const pQueue = new OperationsPriorityQueueImpl<Context>(
        DEFAULT_MAX_QUEUE_ATTEMPTS
    );
    const browser = sharedDeps.browser;
    const sessionStore = new SessionStore(browser);
    const externalIdsSessionCache = new ExternalIdsSessionCacheImpl(
        browser,
        sessionStore
    );
    const deps: SdkDependencies = {
      user: this.user,
      eventFactory: new EventFactoryImpl(
          this.stores,
          this.cookiesStore,
          browser,
          externalIdsSessionCache,
          this.consentService
      ),
      groupFactory: new GroupFactoryImpl(this.stores),
      contextFactory: new ContextFactoryImpl(),
      eventQueue: new EventQueueImpl(
          () => Object.values(this.plugins),
          pQueue,
          browser,
          this.sentryWrapper
      ),
    };

    this.sdk = new Sdk(this.sdkSettings, deps);
    if (this.sdkSettings.options?.autoCapturePII) {
      const autoCapturePII = new AutoCapturePII(
          browser,
          this.user,
          this.sdkSettings.options.autoCapturePhoneRegex
      );
      autoCapturePII.listen();
    }
  }

  private updatePluginSettings() {
    const syncsMap = {};
    for (const sync of this.writeKeySettings.syncs) {
      syncsMap[sync.id] = sync;
    }

    for (const syncID in this.plugins) {
      let settings: PluginSettings = syncsMap[syncID];
      if (!settings) {
        settings = this.sdkSettings;
      }

      const plugin = this.plugins[syncID];
      plugin.updateSettings(settings);
    }
  }

  private initStores() {
    if (this.stores) {
      return;
    }
    const localStore = new BrowserStore(
        BrowserStore.isLocalStorageAvailable() ? localStorage : undefined
    );
    const memoryStore = new MemoryStore();
    const cookiesStore = CookiesStore.isAvailable()
        ? new CookiesStore(this.sdkSettings?.options?.cookie?.domain)
        : new NullStore();
    this.stores = new StoresGroup(localStore, cookiesStore, memoryStore);
    this.cookiesStore = cookiesStore;
  }

  public startNewSession() {
    this.initStores();

    if (this.sessionIntervalId) {
      clearInterval(this.sessionIntervalId);
    }

    const currentEpoch = new Date().getTime();
    if (!this.stores.get(SESSION_ID_PERSISTENCE_KEY)) {
      this.stores.set(SESSION_ID_PERSISTENCE_KEY, currentEpoch);

      const sessionDurationMin =
        this.sdkSettings?.options?.sessionDurationMin ||
        DEFAULT_SESSION_DURATION_MIN;
      this.sessionIntervalId = setInterval(() => {
        const newSessionId = new Date().getTime();
        this.stores.set(SESSION_ID_PERSISTENCE_KEY, newSessionId);

        this.resetUtmCampaign();
      }, sessionDurationMin * 60 * 1000);
    }
  }

  private resetUtmCampaign() {
    UTM_KEYS.forEach((key) => this.stores.remove(key[0]));
  }

  public updateConsent(categoryPreferences: CategoryPreferences): void {
    if (this.consentService) {
      this.consentService.updateConsent(categoryPreferences);
      this.reinitializePlugins();
    }
  }

  private createPlugin(sync: Sync, sharedDeps?): Plugin | null {
    const pluginClass = INTEGRATION_PLUGINS[sync.destination_app];
    if (!pluginClass) return null;

    // Use shared deps if provided, otherwise create new ones
    const deps = sharedDeps || this.createSharedPluginDependencies();

    const pluginDeps: PluginDependencies = {
      user: this.user,
      fieldMapperFactory: deps.fieldMapperFactory,
      eventMapperFactory: new EventMapperFactoryImpl(),
      browser: deps.browser,
      sync: sync,
      testingWriteKey: deps.testingMode,
      externalSDK: deps.pluginExternalSDKs[sync.destination_app],
      enableHashing: this.sdkSettings?.options?.enableHashing,
      logger: deps.logger,
      sentry: this.sentryWrapper,
    };

    return new pluginClass(pluginDeps);
  }

  private createSharedPluginDependencies() {
    const fieldMapperFactory = new FieldsMapperFactoryImpl();
    const browser = new BrowserImpl();
    const logger: Logger = {
      log: (...args) => console.log(JOURNIFY_PREFIX, ...args),
    };
    const testingMode = isTestingWriteKey(this.sdkSettings.writeKey);
    const pluginExternalSDKs = {
      clevertap: new CleverTapWrapperImpl(browser, logger, testingMode),
    };

    return {
      fieldMapperFactory,
      browser,
      logger,
      testingMode,
      pluginExternalSDKs,
    };
  }

  private reinitializePlugins(): void {
    const sharedDeps = this.createSharedPluginDependencies();

    for (const sync of this.writeKeySettings.syncs) {
      const hasConsent = this.consentService.hasConsent(sync.destination_consent_categories);
      const pluginExists = !!this.plugins[sync.id];

      if (hasConsent && !pluginExists) {
        const plugin = this.createPlugin(sync, sharedDeps);
        if (plugin) {
          this.plugins[sync.id] = plugin;
        }
      } else if (!hasConsent && pluginExists) {
        delete this.plugins[sync.id];
      }
    }
  }

}

const WRITE_KEY_TEST_PREFIX = "wk_test_";
const WRITE_KEY_PROD_PREFIX = "wk_";
function isTestingWriteKey(writeKey: string): boolean {
  return writeKey?.startsWith(WRITE_KEY_TEST_PREFIX);
}

export function getProductionWriteKey(writeKey: string): string {
  if (isTestingWriteKey(writeKey)) {
    return writeKey?.replace(WRITE_KEY_TEST_PREFIX, WRITE_KEY_PROD_PREFIX);
  }

  return writeKey;
}

const DEFAULT_MAX_QUEUE_ATTEMPTS = 2;
const DEFAULT_SESSION_DURATION_MIN = 30;
