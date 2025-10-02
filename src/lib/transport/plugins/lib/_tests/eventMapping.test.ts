import {EventFilter, EventMapping, FilterOperator, TrackingEventType} from "../../plugin";
import {JournifyEventType} from "../../../../domain/event";
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