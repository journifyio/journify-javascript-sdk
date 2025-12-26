/* eslint-disable  @typescript-eslint/no-explicit-any */
import {JournifyEvent, JournifyEventType} from "../../../domain/event";
import {User} from "../../../domain/user";
import {Browser} from "../../browser";
import {Context} from "../../context";
import {Logger, PluginDependencies, Sync, Plugin} from "../plugin";
import {toLowerCase, trim, toE164} from "../lib/tranformations";
import {toSettingsObject} from "../lib/settings";
import {getStoredIdentify} from "../lib/identify";
import {FieldsMapper, FieldsMapperFactory} from "../lib/fieldMapping";
import {EventMapper, EventMapperFactory} from "../lib/eventMapping";

declare global {
    interface Window {
        TiktokAnalyticsObject?: string;
        ttq?: any;
    }
}
const TIKTOK_SCRIPT_URL = "https://analytics.tiktok.com/i18n/pixel/events.js";

export class TikTokPixel implements Plugin {
    public readonly name = "tiktok_pixel";
    private readonly browser: Browser;
    private readonly user: User;
    private readonly fieldMapperFactory: FieldsMapperFactory;
    private readonly eventMapperFactory: EventMapperFactory;
    private readonly testingMode: boolean;
    private readonly logger: Logger;

    private settings: Record<string, string>;
    private fieldsMapper: FieldsMapper;
    private eventMapper: EventMapper;

    public constructor(deps: PluginDependencies) {
        this.user = deps.user;
        this.browser = deps.browser;
        this.eventMapperFactory = deps.eventMapperFactory;
        this.fieldMapperFactory = deps.fieldMapperFactory;
        this.testingMode = deps.testingWriteKey;
        this.logger = deps.logger;
        this.init(deps.sync);
    }

    identify(ctx: Context): Context {
        const newEvent = ctx.getEvent();
        const storedEvent = getStoredIdentify(this.user);

        const event = {
            type: JournifyEventType.IDENTIFY,
            userId: newEvent.userId || storedEvent.userId,
            anonymousId: newEvent.anonymousId || storedEvent.anonymousId,
            traits: {
                ...(storedEvent.traits || {}),
                ...(newEvent.traits || {}),
            },
        };
        const userData = this.mapUserData(event);
        this.callPixelHelper(event.type, userData);

        return this.trackPixelEvent(ctx);
    }

    track(ctx: Context) {
        return this.trackPixelEvent(ctx);
    }

    page(ctx: Context) {
        return this.trackPixelEvent(ctx);
    }

    group(ctx: Context) {
        return this.trackPixelEvent(ctx);
    }

    updateSettings(sync: Sync) {
        this.init(sync);
    }

  private init(sync: Sync) {
    this.fieldsMapper = this.fieldMapperFactory.newFieldMapper(
      sync.field_mappings,
      () => new Date()
    );
    this.eventMapper = this.eventMapperFactory.newEventMapper(sync.event_mappings);
    this.settings = toSettingsObject(sync.settings);

    if (this.testingMode) {
      this.logger.log(
        `Tiktok Pixel ${this.settings.pixel_code} is detected, but script is not injected because you are using a testing write key.`
      );
    } else {
      this.loadTiktokPixel();
    }
  }

    private mapUserData(event: JournifyEvent): object {
        const transformationsMap: Record<string, ((val: string) => string)[]> = {
            email: [trim, toLowerCase],
            phone_number: [trim, toE164],
            external_id: [trim],
        };
        return this.fieldsMapper.mapEvent(event, transformationsMap);
    }

    private callPixelHelper(
        eventType: JournifyEventType,
        args: any,
        eventId = "",
        traits: any = {}
    ) {
        const event = {
            ...args,
            pixelCode: this.settings.pixel_code,
        };
        const ttqInstance = window.ttq.instance(event.pixelCode)

        switch (eventType) {
            case JournifyEventType.IDENTIFY:
                if (this.testingMode) {
                    return this.logger.log(
                        "Will call window.ttq.identify with the following params in order:",
                        {...event, event_id: eventId}
                    );
                }

                ttqInstance.identify({
                    ...event,
                    event_id: eventId,
                });
                break;
            case JournifyEventType.PAGE:
                if (args.event === "Pageview") {
                    if (this.testingMode) {
                        return this.logger.log(
                            "Will call window.ttq.page with the following params in order:",
                            {...event, event_id: eventId}
                        );
                    }
                    ttqInstance.identify(traits);
                    ttqInstance.page({
                        ...event,
                        event_id: eventId,
                    });
                } else {
                    if (this.testingMode) {
                        return this.logger.log(
                            "Will call window.ttq.track with the following params in order:",
                            args.event,
                            event,
                            {event_id: eventId}
                        );
                    }
                    ttqInstance.identify(traits);
                    ttqInstance.track(args.event, event, {event_id: eventId});
                }
                break;
            default:
                if (this.testingMode) {
                    return this.logger.log(
                        "Will call window.ttq.track with the following params in order:",
                        args.event,
                        event,
                        {event_id: eventId}
                    );
                }
                ttqInstance.identify(traits);
                ttqInstance.track(args.event, event, {event_id: eventId});
                break;
        }
    }

    private trackPixelEvent(ctx: Context): Context {
        const event = ctx.getEvent();
        const mappedEvent = this.eventMapper.applyEventMapping(event);
        if (!mappedEvent) {
            return ctx;
        }
        console.log("Mapped event:", event);
        const mappedProperties = this.fieldsMapper.mapEvent(event);
        const eventId = mappedProperties.event_id;
        delete mappedProperties.event_id;

        const traits = this.mapUserData(event);
        const eventName = mappedEvent?.pixelEventName || event.event;
        this.callPixelHelper(
            event.type,
            {
                ...mappedProperties,
                event: eventName,
            },
            eventId,
            traits
        );

        return ctx;
    }

    /* eslint-disable */
    private loadTiktokPixel() {
        const w = this.browser.window();
        const d = this.browser.document();
        const t = "ttq";
        w.TiktokAnalyticsObject = t;
        var ttq = (w[t] = w[t] || []);
        (ttq.methods = [
            "page",
            "track",
            "identify",
            "instances",
            "debug",
            "on",
            "off",
            "once",
            "ready",
            "alias",
            "group",
            "enableCookie",
            "disableCookie",
        ]),
            (ttq.setAndDefer = function (t, e) {
                t[e] = function () {
                    t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
                };
            });
        for (var i = 0; i < ttq.methods.length; i++)
            ttq.setAndDefer(ttq, ttq.methods[i]);
        (ttq.instance = function (t) {
            for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++)
                ttq.setAndDefer(e, ttq.methods[n]);
            return e;
        }),
            (ttq.load = function (e, n) {
                var i = TIKTOK_SCRIPT_URL;
                (ttq._i = ttq._i || {}),
                    (ttq._i[e] = []),
                    (ttq._i[e]._u = i),
                    (ttq._t = ttq._t || {}),
                    (ttq._t[e] = +new Date()),
                    (ttq._o = ttq._o || {}),
                    (ttq._partner = ttq._partner || "Journify"),
                    (ttq._o[e] = n || {});
                var o = d.createElement("script");
                (o.type = "text/javascript"),
                    (o.async = !0),
                    (o.src = i + "?sdkid=" + e + "&lib=" + t);
                var a = d.getElementsByTagName("script")[0];
                a.parentNode.insertBefore(o, a);
            });
        ttq.load(this.settings.pixel_code);
    }

    /* eslint-enable */
}
