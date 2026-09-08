import {filters, FilterImplOptions, Liquid} from "liquidjs";

const MIN_TIMEZONE_OFFSET_MINUTES = -840;
const MAX_TIMEZONE_OFFSET_MINUTES = 720;

type LiquidFilter = Exclude<FilterImplOptions, {handler: unknown}>;

const liquidDateFilter = filters.date as LiquidFilter;

export function newLiquidEngine(): Liquid {
    const engine = new Liquid();
    engine.registerFilter("date_tz", dateTZFilter);
    return engine;
}

function dateTZFilter(
    this: ThisParameterType<LiquidFilter>,
    date: unknown,
    dateFormat: unknown,
    timezone?: unknown
): unknown {
    if (timezone === undefined || timezone === null) {
        throw new Error("timezone is required");
    }

    if (typeof timezone === "number") {
        if (!Number.isInteger(timezone)) {
            throw new Error(
                `timezone offset must be an integer: ${timezone}`
            );
        }
        if (
            timezone < MIN_TIMEZONE_OFFSET_MINUTES ||
            timezone > MAX_TIMEZONE_OFFSET_MINUTES
        ) {
            throw new Error(
                `timezone offset must be between ${MIN_TIMEZONE_OFFSET_MINUTES} and ${MAX_TIMEZONE_OFFSET_MINUTES} minutes: ${timezone}`
            );
        }
    } else if (typeof timezone === "string") {
        try {
            new Intl.DateTimeFormat("en-US", {timeZone: timezone});
        } catch (_error) {
            throw new Error(`invalid IANA timezone: "${timezone}"`);
        }
    } else {
        throw new Error(
            `unsupported timezone type: ${typeof timezone}; expected an IANA timezone string or integer offset in minutes`
        );
    }

    return liquidDateFilter.call(this, date, dateFormat, timezone);
}
