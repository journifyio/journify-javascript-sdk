import {EventFilter, EventMapping, FilterOperator, TrackingEventType} from "../../plugin";
import {JournifyEvent, JournifyEventType} from "../../../../domain/event";
import {Context} from "../../../context";
import {EventMapperFactoryImpl} from "../eventMapping";

describe("EventMapper", () => {
    const eventMapperFactory = new EventMapperFactoryImpl();
    const eventMappings: EventMapping[] = [
        {
            enabled: true,
            event_type: TrackingEventType.TRACK_EVENT,
            event_name: "test_event",
            destination_event_key: "pixel_test_event",
            filters: [],
        },
        {
            enabled: true,
            event_type: TrackingEventType.PAGE_EVENT,
            event_name: "",
            destination_event_key: "pixel_page_event",
            filters: [],
        },
        {
            enabled: true,
            event_type: TrackingEventType.GROUP_EVENT,
            event_name: "",
            destination_event_key: "pixel_group_event",
            filters: [],
        },
        {
            enabled: true,
            event_type: TrackingEventType.IDENTIFY_EVENT,
            event_name: "",
            destination_event_key: "pixel_identify_event",
            filters: [],
        },
    ];

    describe("applyEventMapping", () => {
        it("should return the correct mapping for a TRACK event", () => {
            const eventMapper = eventMapperFactory.newEventMapper(eventMappings);
            const mappedEvent = eventMapper.applyEventMapping({
                type: JournifyEventType.TRACK,
                event: "test_event",
            });
            expect(mappedEvent).toEqual({
                pixelEventName: "pixel_test_event",
            });
        });

        it("should return the correct mapping for a PAGE event", () => {
            const eventMapper = eventMapperFactory.newEventMapper(eventMappings);
            const mappedEvent = eventMapper.applyEventMapping({
                type: JournifyEventType.PAGE,
                event: "",
            });
            expect(mappedEvent).toEqual({
                pixelEventName: "pixel_page_event",
            });
        });

        it("should return the correct mapping for a GROUP event", () => {
            const eventMapper = eventMapperFactory.newEventMapper(eventMappings);
            const mappedEvent = eventMapper.applyEventMapping({
                type: JournifyEventType.GROUP,
            });
            expect(mappedEvent).toEqual({
                pixelEventName: "pixel_group_event",
            });
        });

        it("should return the correct mapping for an IDENTIFY event", () => {
            const eventMapper = eventMapperFactory.newEventMapper(eventMappings);
            const mappedEvent = eventMapper.applyEventMapping({
                type: JournifyEventType.IDENTIFY,
                event: "",
            });
            expect(mappedEvent).toEqual({
                pixelEventName: "pixel_identify_event",
            });
        });

        it("should return null for an unsupported event type", () => {
            const eventMapper = eventMapperFactory.newEventMapper(eventMappings);
            const ctx = {
                getEvent: () => ({ type: "UNSUPPORTED_EVENT_TYPE", event: "" }),
            } as unknown as Context;
            const mappedEvent = eventMapper.applyEventMapping(ctx.getEvent());
            expect(mappedEvent).toBeNull();
        });

        it("should return the mapped event if all filters match", () => {
            const filters: EventFilter[] = [
                {
                    field: "context.page.url",
                    operator: FilterOperator.EQUALS,
                    value: "https://www.example.com",
                },
                {
                    field: "context.page.title",
                    operator: FilterOperator.NOT_EQUALS,
                    value: "Hello world",
                },
                {
                    field: "properties.field.subfield",
                    operator: FilterOperator.CONTAINS,
                    value: "Unix",
                },
                {
                    field: "properties.field.subfield",
                    operator: FilterOperator.NOT_CONTAINS,
                    value: "Linux",
                },
                {
                    field: "properties.field2.subfield2",
                    operator: FilterOperator.NOT_CONTAINS,
                    value: "Unix",
                },
                {
                    field: "properties.field2.subfield2",
                    operator: FilterOperator.CONTAINS,
                    value: "Linux",
                },
                {
                    field: "properties.amount",
                    operator: FilterOperator.GREATER_THAN,
                    value: 1000,
                },
                {
                    field: "properties.value",
                    operator: FilterOperator.GREATER_THAN_OR_EQ,
                    value: 2039.7,
                },
                {
                    field: "properties.quantity",
                    operator: FilterOperator.LESS_THAN,
                    value: 5,
                },
                {
                    field: "properties.orders",
                    operator: FilterOperator.LESS_THAN_OR_EQ,
                    value: 10000002,
                },
            ];
            const eventMappings: EventMapping[] = [
                {
                    enabled: true,
                    event_type: TrackingEventType.TRACK_EVENT,
                    event_name: "add_to_cart",
                    destination_event_key: "pixel_add_to_cart",
                },
                {
                    enabled: true,
                    event_type: TrackingEventType.TRACK_EVENT,
                    event_name: "purchase",
                    destination_event_key: "PURCHASE",
                    filters: filters,
                },
            ];
            const eventMapper = eventMapperFactory.newEventMapper(eventMappings);

            const mappedEvent = eventMapper.applyEventMapping({
                type: JournifyEventType.TRACK,
                context: {
                    page: {
                        url: "https://www.example.com",
                        title: "Hello Journify",
                    },
                },
                event: "purchase",
                properties: {
                    amount: 1001,
                    value: 2039.7,
                    quantity: 4,
                    orders: 10000002,
                    field: {
                        subfield: "Unix is great",
                    },
                    field2: {
                        subfield2: "Linux is great",
                    }
                },
            });

            expect(mappedEvent).toEqual({
                pixelEventName: "PURCHASE",
            })
        });

        it("should return null if one of the filters doesn't match", () => {
            const filters: EventFilter[] = [
                {
                    field: "context.page.url",
                    operator: FilterOperator.EQUALS,
                    value: "https://www.example.com",
                },
                {
                    field: "properties.field.subfield",
                    operator: FilterOperator.EQUALS,
                    value: "Hello world",
                },
            ];
            const eventMappings: EventMapping[] = [
                {
                    enabled: true,
                    event_type: TrackingEventType.TRACK_EVENT,
                    event_name: "add_to_cart",
                    destination_event_key: "pixel_add_to_cart",
                    filters: filters,
                },
                {
                    enabled: true,
                    event_type: TrackingEventType.TRACK_EVENT,
                    event_name: "purchase",
                    destination_event_key: "PURCHASE",
                },
            ];
            const eventMapper = eventMapperFactory.newEventMapper(eventMappings);

            const mappedEvent = eventMapper.applyEventMapping({
                type: JournifyEventType.TRACK,
                context: {
                    page: {
                        url: "https://www.example.com",
                        title: "Hello Journify",
                    },
                },
                event: "add_to_cart",
                properties: {
                    field: {
                        subfield: "Hello mars",
                    },
                },
            });

            expect(mappedEvent).toBeNull()
        });

        describe("matchFilter - type coercion", () => {
            function makeMapper(filter: EventFilter) {
                return eventMapperFactory.newEventMapper([
                    {
                        enabled: true,
                        event_type: TrackingEventType.TRACK_EVENT,
                        event_name: "test",
                        destination_event_key: "DEST",
                        filters: [filter],
                    },
                ]);
            }

            function trackEvent(properties: Record<string, unknown>) {
                return {
                    type: JournifyEventType.TRACK,
                    event: "test",
                    properties,
                } as JournifyEvent;
            }

            // --- EQUALS with type coercion ---
            it("EQUALS: string filter matches string event value", () => {
                const mapper = makeMapper({
                    field: "properties.name",
                    operator: FilterOperator.EQUALS,
                    value: "hello",
                });
                expect(mapper.applyEventMapping(trackEvent({ name: "hello" }))).toEqual({ pixelEventName: "DEST" });
            });

            it("EQUALS: string filter does not match different string", () => {
                const mapper = makeMapper({
                    field: "properties.name",
                    operator: FilterOperator.EQUALS,
                    value: "hello",
                });
                expect(mapper.applyEventMapping(trackEvent({ name: "world" }))).toBeNull();
            });

            it("EQUALS: string filter '42' matches number 42 via coercion", () => {
                const mapper = makeMapper({
                    field: "properties.count",
                    operator: FilterOperator.EQUALS,
                    value: "42",
                });
                expect(mapper.applyEventMapping(trackEvent({ count: 42 }))).toEqual({ pixelEventName: "DEST" });
            });

            it("EQUALS: string filter '42' does not match number 99", () => {
                const mapper = makeMapper({
                    field: "properties.count",
                    operator: FilterOperator.EQUALS,
                    value: "42",
                });
                expect(mapper.applyEventMapping(trackEvent({ count: 99 }))).toBeNull();
            });

            it("EQUALS: string filter 'true' matches boolean true via coercion", () => {
                const mapper = makeMapper({
                    field: "properties.active",
                    operator: FilterOperator.EQUALS,
                    value: "true",
                });
                expect(mapper.applyEventMapping(trackEvent({ active: true }))).toEqual({ pixelEventName: "DEST" });
            });

            it("EQUALS: string filter 'false' matches boolean false via coercion", () => {
                const mapper = makeMapper({
                    field: "properties.active",
                    operator: FilterOperator.EQUALS,
                    value: "false",
                });
                expect(mapper.applyEventMapping(trackEvent({ active: false }))).toEqual({ pixelEventName: "DEST" });
            });

            it("EQUALS: string filter 'true' does not match boolean false", () => {
                const mapper = makeMapper({
                    field: "properties.active",
                    operator: FilterOperator.EQUALS,
                    value: "true",
                });
                expect(mapper.applyEventMapping(trackEvent({ active: false }))).toBeNull();
            });

            it("EQUALS: string filter '3.14' matches number 3.14", () => {
                const mapper = makeMapper({
                    field: "properties.rate",
                    operator: FilterOperator.EQUALS,
                    value: "3.14",
                });
                expect(mapper.applyEventMapping(trackEvent({ rate: 3.14 }))).toEqual({ pixelEventName: "DEST" });
            });

            it("EQUALS: non-numeric string filter stays string when event value is number", () => {
                const mapper = makeMapper({
                    field: "properties.count",
                    operator: FilterOperator.EQUALS,
                    value: "abc",
                });
                expect(mapper.applyEventMapping(trackEvent({ count: 42 }))).toBeNull();
            });

            // --- NOT_EQUALS with type coercion ---
            it("NOT_EQUALS: string filter '42' does not match number 42 (equal after coercion)", () => {
                const mapper = makeMapper({
                    field: "properties.count",
                    operator: FilterOperator.NOT_EQUALS,
                    value: "42",
                });
                expect(mapper.applyEventMapping(trackEvent({ count: 42 }))).toBeNull();
            });

            it("NOT_EQUALS: string filter '42' matches number 99 (different after coercion)", () => {
                const mapper = makeMapper({
                    field: "properties.count",
                    operator: FilterOperator.NOT_EQUALS,
                    value: "42",
                });
                expect(mapper.applyEventMapping(trackEvent({ count: 99 }))).toEqual({ pixelEventName: "DEST" });
            });

            it("NOT_EQUALS: string filter 'true' does not match boolean true", () => {
                const mapper = makeMapper({
                    field: "properties.active",
                    operator: FilterOperator.NOT_EQUALS,
                    value: "true",
                });
                expect(mapper.applyEventMapping(trackEvent({ active: true }))).toBeNull();
            });

            it("NOT_EQUALS: string filter 'true' matches boolean false", () => {
                const mapper = makeMapper({
                    field: "properties.active",
                    operator: FilterOperator.NOT_EQUALS,
                    value: "true",
                });
                expect(mapper.applyEventMapping(trackEvent({ active: false }))).toEqual({ pixelEventName: "DEST" });
            });

            // --- GREATER_THAN with type coercion ---
            it("GREATER_THAN: number event value > string filter coerced to number", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.GREATER_THAN,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 200 }))).toEqual({ pixelEventName: "DEST" });
            });

            it("GREATER_THAN: number event value not > string filter coerced to number", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.GREATER_THAN,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 50 }))).toBeNull();
            });

            it("GREATER_THAN: equal values should not match", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.GREATER_THAN,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 100 }))).toBeNull();
            });

            // --- GREATER_THAN_OR_EQ with type coercion ---
            it("GREATER_THAN_OR_EQ: equal values should match", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.GREATER_THAN_OR_EQ,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 100 }))).toEqual({ pixelEventName: "DEST" });
            });

            it("GREATER_THAN_OR_EQ: greater value should match", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.GREATER_THAN_OR_EQ,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 101 }))).toEqual({ pixelEventName: "DEST" });
            });

            it("GREATER_THAN_OR_EQ: lesser value should not match", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.GREATER_THAN_OR_EQ,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 99 }))).toBeNull();
            });

            // --- LESS_THAN with type coercion ---
            it("LESS_THAN: number event value < string filter coerced to number", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.LESS_THAN,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 50 }))).toEqual({ pixelEventName: "DEST" });
            });

            it("LESS_THAN: equal values should not match", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.LESS_THAN,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 100 }))).toBeNull();
            });

            it("LESS_THAN: greater value should not match", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.LESS_THAN,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 200 }))).toBeNull();
            });

            // --- LESS_THAN_OR_EQ with type coercion ---
            it("LESS_THAN_OR_EQ: equal values should match", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.LESS_THAN_OR_EQ,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 100 }))).toEqual({ pixelEventName: "DEST" });
            });

            it("LESS_THAN_OR_EQ: lesser value should match", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.LESS_THAN_OR_EQ,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 50 }))).toEqual({ pixelEventName: "DEST" });
            });

            it("LESS_THAN_OR_EQ: greater value should not match", () => {
                const mapper = makeMapper({
                    field: "properties.amount",
                    operator: FilterOperator.LESS_THAN_OR_EQ,
                    value: "100",
                });
                expect(mapper.applyEventMapping(trackEvent({ amount: 200 }))).toBeNull();
            });

            // --- LESS_THAN_OR_EQ with float coercion ---
            it("LESS_THAN_OR_EQ: float string filter coerced correctly", () => {
                const mapper = makeMapper({
                    field: "properties.price",
                    operator: FilterOperator.LESS_THAN_OR_EQ,
                    value: "9.99",
                });
                expect(mapper.applyEventMapping(trackEvent({ price: 9.99 }))).toEqual({ pixelEventName: "DEST" });
                expect(mapper.applyEventMapping(trackEvent({ price: 10 }))).toBeNull();
            });
        });

        describe("matchFilter - string operators", () => {
            function makeMapper(filter: EventFilter) {
                return eventMapperFactory.newEventMapper([
                    {
                        enabled: true,
                        event_type: TrackingEventType.TRACK_EVENT,
                        event_name: "test",
                        destination_event_key: "DEST",
                        filters: [filter],
                    },
                ]);
            }

            function trackEvent(properties: Record<string, unknown>) {
                return {
                    type: JournifyEventType.TRACK,
                    event: "test",
                    properties,
                } as JournifyEvent;
            }

            // --- CONTAINS ---
            it("CONTAINS: matches when event value contains filter value", () => {
                const mapper = makeMapper({
                    field: "properties.name",
                    operator: FilterOperator.CONTAINS,
                    value: "world",
                });
                expect(mapper.applyEventMapping(trackEvent({ name: "hello world" }))).toEqual({ pixelEventName: "DEST" });
            });

            it("CONTAINS: does not match when event value does not contain filter value", () => {
                const mapper = makeMapper({
                    field: "properties.name",
                    operator: FilterOperator.CONTAINS,
                    value: "xyz",
                });
                expect(mapper.applyEventMapping(trackEvent({ name: "hello world" }))).toBeNull();
            });

            // --- NOT_CONTAINS ---
            it("NOT_CONTAINS: matches when event value does not contain filter value", () => {
                const mapper = makeMapper({
                    field: "properties.name",
                    operator: FilterOperator.NOT_CONTAINS,
                    value: "xyz",
                });
                expect(mapper.applyEventMapping(trackEvent({ name: "hello world" }))).toEqual({ pixelEventName: "DEST" });
            });

            it("NOT_CONTAINS: does not match when event value contains filter value", () => {
                const mapper = makeMapper({
                    field: "properties.name",
                    operator: FilterOperator.NOT_CONTAINS,
                    value: "hello",
                });
                expect(mapper.applyEventMapping(trackEvent({ name: "hello world" }))).toBeNull();
            });

            // --- STARTS_WITH ---
            it("STARTS_WITH: matches when event value starts with filter value", () => {
                const mapper = makeMapper({
                    field: "properties.url",
                    operator: FilterOperator.STARTS_WITH,
                    value: "https://",
                });
                expect(mapper.applyEventMapping(trackEvent({ url: "https://example.com" }))).toEqual({ pixelEventName: "DEST" });
            });

            it("STARTS_WITH: does not match when event value does not start with filter value", () => {
                const mapper = makeMapper({
                    field: "properties.url",
                    operator: FilterOperator.STARTS_WITH,
                    value: "https://",
                });
                expect(mapper.applyEventMapping(trackEvent({ url: "http://example.com" }))).toBeNull();
            });

            // --- ENDS_WITH ---
            it("ENDS_WITH: matches when event value ends with filter value", () => {
                const mapper = makeMapper({
                    field: "properties.email",
                    operator: FilterOperator.ENDS_WITH,
                    value: "@example.com",
                });
                expect(mapper.applyEventMapping(trackEvent({ email: "user@example.com" }))).toEqual({ pixelEventName: "DEST" });
            });

            it("ENDS_WITH: does not match when event value does not end with filter value", () => {
                const mapper = makeMapper({
                    field: "properties.email",
                    operator: FilterOperator.ENDS_WITH,
                    value: "@example.com",
                });
                expect(mapper.applyEventMapping(trackEvent({ email: "user@other.com" }))).toBeNull();
            });
        });

        describe("matchFilter - edge cases", () => {
            function makeMapper(filter: EventFilter) {
                return eventMapperFactory.newEventMapper([
                    {
                        enabled: true,
                        event_type: TrackingEventType.TRACK_EVENT,
                        event_name: "test",
                        destination_event_key: "DEST",
                        filters: [filter],
                    },
                ]);
            }

            function trackEvent(properties: Record<string, unknown>) {
                return {
                    type: JournifyEventType.TRACK,
                    event: "test",
                    properties,
                } as JournifyEvent;
            }

            it("EQUALS: undefined event value does not match", () => {
                const mapper = makeMapper({
                    field: "properties.missing",
                    operator: FilterOperator.EQUALS,
                    value: "something",
                });
                expect(mapper.applyEventMapping(trackEvent({}))).toBeNull();
            });

            it("NOT_EQUALS: undefined event value does match (undefined !== 'something')", () => {
                const mapper = makeMapper({
                    field: "properties.missing",
                    operator: FilterOperator.NOT_EQUALS,
                    value: "something",
                });
                expect(mapper.applyEventMapping(trackEvent({}))).toEqual({ pixelEventName: "DEST" });
            });

            it("EQUALS: nested field access works", () => {
                const mapper = makeMapper({
                    field: "properties.nested.deep.value",
                    operator: FilterOperator.EQUALS,
                    value: "found",
                });
                expect(mapper.applyEventMapping(trackEvent({ nested: { deep: { value: "found" } } }))).toEqual({ pixelEventName: "DEST" });
            });

            it("EQUALS: nested field access returns null for missing nested path", () => {
                const mapper = makeMapper({
                    field: "properties.nested.deep.value",
                    operator: FilterOperator.EQUALS,
                    value: "found",
                });
                expect(mapper.applyEventMapping(trackEvent({ nested: {} }))).toBeNull();
            });

            it("EQUALS: number 0 matches string filter '0'", () => {
                const mapper = makeMapper({
                    field: "properties.count",
                    operator: FilterOperator.EQUALS,
                    value: "0",
                });
                expect(mapper.applyEventMapping(trackEvent({ count: 0 }))).toEqual({ pixelEventName: "DEST" });
            });

            it("EQUALS: negative number matches string filter", () => {
                const mapper = makeMapper({
                    field: "properties.temp",
                    operator: FilterOperator.EQUALS,
                    value: "-5",
                });
                expect(mapper.applyEventMapping(trackEvent({ temp: -5 }))).toEqual({ pixelEventName: "DEST" });
            });

            it("multiple filters act as AND - all must match", () => {
                const mapper = eventMapperFactory.newEventMapper([
                    {
                        enabled: true,
                        event_type: TrackingEventType.TRACK_EVENT,
                        event_name: "test",
                        destination_event_key: "DEST",
                        filters: [
                            {
                                field: "properties.active",
                                operator: FilterOperator.EQUALS,
                                value: "true",
                            },
                            {
                                field: "properties.count",
                                operator: FilterOperator.GREATER_THAN,
                                value: "10",
                            },
                        ],
                    },
                ]);
                // both match
                expect(mapper.applyEventMapping(trackEvent({ active: true, count: 20 }))).toEqual({ pixelEventName: "DEST" });
                // first matches, second doesn't
                expect(mapper.applyEventMapping(trackEvent({ active: true, count: 5 }))).toBeNull();
                // first doesn't match
                expect(mapper.applyEventMapping(trackEvent({ active: false, count: 20 }))).toBeNull();
            });
        });

        it("should return the event that matches filters when the same source event is mapped to different destination events", () => {
            const eventMappings: EventMapping[] = [
                {
                    enabled: true,
                    event_type: TrackingEventType.TRACK_EVENT,
                    event_name: "purchase",
                    destination_event_key: "PURCHASE_1",
                    filters: [
                        {
                            field: "context.page.url",
                            operator: FilterOperator.EQUALS,
                            value: "https://www.example.com",
                        },
                        {
                            field: "context.page.title",
                            operator: FilterOperator.EQUALS,
                            value: "Hello world 1",
                        },
                    ]
                },
                {
                    enabled: true,
                    event_type: TrackingEventType.TRACK_EVENT,
                    event_name: "purchase",
                    destination_event_key: "PURCHASE_2",
                    filters: [
                        {
                            field: "context.page.url",
                            operator: FilterOperator.EQUALS,
                            value: "https://www.example.com",
                        },
                        {
                            field: "context.page.title",
                            operator: FilterOperator.EQUALS,
                            value: "Hello world 2",
                        },
                    ],
                },
            ];
            const eventMapper = eventMapperFactory.newEventMapper(eventMappings);

            const mappedEvent = eventMapper.applyEventMapping({
                type: JournifyEventType.TRACK,
                context: {
                    page: {
                        url: "https://www.example.com",
                        title: "Hello world 2",
                    },
                },
                event: "purchase",
                properties: {
                    amount: 1001,
                    value: 2039.7,
                    quantity: 4,
                    orders: 10000002,
                    field: {
                        subfield: "Unix is great",
                    },
                    field2: {
                        subfield2: "Linux is great",
                    }
                },
            });

            expect(mappedEvent).toEqual({
                pixelEventName: "PURCHASE_2",
            })
        });
    });
});