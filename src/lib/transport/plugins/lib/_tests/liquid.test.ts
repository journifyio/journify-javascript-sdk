import {newLiquidEngine} from "../liquid";

describe("Liquid filters", () => {
    const date = "1990-12-31T23:00:00Z";
    const dateFormat = "%Y-%m-%dT%H:%M:%S";

    describe.each([
        {
            name: "numeric timezone offset",
            timezone: "360",
            expected: "1990-12-31T17:00:00",
        },
        {
            name: "minimum numeric timezone offset",
            timezone: "-840",
            expected: "1991-01-01T13:00:00",
        },
        {
            name: "maximum numeric timezone offset",
            timezone: "720",
            expected: "1990-12-31T11:00:00",
        },
        {
            name: "IANA timezone",
            timezone: '"Asia/Colombo"',
            expected: "1991-01-01T04:30:00",
        },
        {
            name: "IANA timezone during daylight-saving time",
            date: "2024-07-01T12:00:00Z",
            timezone: '"America/New_York"',
            expected: "2024-07-01T08:00:00",
        },
    ])("$name", ({date: testDate = date, timezone, expected}) => {
        it("formats the date in the requested timezone", () => {
            const engine = newLiquidEngine();
            const template = `{{ "${testDate}" | date_tz: "${dateFormat}", ${timezone} }}`;

            expect(engine.parseAndRenderSync(template)).toBe(expected);
        });
    });

    describe.each([
        {
            name: "offset below the minimum",
            timezone: "-841",
            error: "timezone offset must be between -840 and 720 minutes: -841",
        },
        {
            name: "offset above the maximum",
            timezone: "721",
            error: "timezone offset must be between -840 and 720 minutes: 721",
        },
        {
            name: "non-integer numeric offset",
            timezone: "360.5",
            error: "timezone offset must be an integer: 360.5",
        },
        {
            name: "missing timezone",
            error: "timezone is required",
        },
        {
            name: "invalid IANA timezone",
            timezone: '"invalid/timezone"',
            error: 'invalid IANA timezone: "invalid/timezone"',
        },
        {
            name: "numeric string is not coerced to an offset",
            timezone: '"360"',
            error: 'invalid IANA timezone: "360"',
        },
        {
            name: "unsupported timezone type",
            timezone: "timezone",
            context: {timezone: true},
            error: "unsupported timezone type: boolean",
        },
    ])("$name", ({timezone, context, error}) => {
        it("rejects the timezone", () => {
            const engine = newLiquidEngine();
            const timezoneArgument = timezone ? `, ${timezone}` : "";
            const template = `{{ "${date}" | date_tz: "${dateFormat}"${timezoneArgument} }}`;

            expect(() => engine.parseAndRenderSync(template, context)).toThrow(
                error
            );
        });
    });

    it("does not change the built-in date filter", () => {
        const engine = newLiquidEngine();
        const template = `{{ "${date}" | date: "${dateFormat}", 360 }}`;

        expect(engine.parseAndRenderSync(template)).toBe(
            "1990-12-31T17:00:00"
        );
    });
});
