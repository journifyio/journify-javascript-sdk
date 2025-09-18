import { EventMapperFactoryImpl, FieldsMapperFactoryImpl } from "../mapping";
import {
  EventMapping,
  FieldMapping,
  FieldMappingSourceType,
  TrackingEventType,
} from "../../plugin";
import { Transformation } from "../tranformations";
import { JournifyEventType } from "../../../../domain/event";
import { Context } from "../../../context";

describe("Fields mapper", () => {
  it("should create a valid FieldsMapper", () => {
    const factory = new FieldsMapperFactoryImpl();
    const mapper = factory.newFieldMapper([], () => new Date());
    expect(mapper).toBeDefined();
  });

  it("should return empty object when event is empty or null", () => {
    const factory = new FieldsMapperFactoryImpl();
    const mapper = factory.newFieldMapper([], () => new Date());

    const resultEmptyObj = mapper.mapEvent({});
    expect(resultEmptyObj).toEqual({});
    const resultNullObj = mapper.mapEvent(null);
    expect(resultNullObj).toEqual({});
  });

  it("should map event correctly", () => {
    const fieldsMapping: FieldMapping[] = [
      {
        source: {
          type: FieldMappingSourceType.FIELD,
          value: "externalIds.email",
        },
        target: {
          name: "email",
        },
      },
      {
        source: {
          type: FieldMappingSourceType.FIELD,
          value: "properties.to_be_mapped",
        },
        target: {
          name: "prop_example",
        },
      },
      {
        source: {
          type: FieldMappingSourceType.TEMPLATE,
          value: "Hello {{record.externalIds.firstname}}",
        },
        target: {
          name: "firstname",
        },
      },
      {
        source: {
          type: FieldMappingSourceType.TEMPLATE,
          value: "Hello {{record.lastname}}",
        },
        target: {
          name: "lastname",
        },
      },
      {
        source: {
          type: FieldMappingSourceType.CONSTANT,
          value: "subscribed",
        },
        target: {
          name: "status",
        },
      },
      {
        source: {
          type: FieldMappingSourceType.VARIABLE,
          value: "CURRENT_TIME",
        },
        target: {
          name: "timestamp",
        },
      },
      {
        source: {
          type: FieldMappingSourceType.VARIABLE,
          value: "CURRENT_DATE",
        },
        target: {
          name: "date",
        },
      },
      {
        source: {
          type: FieldMappingSourceType.FIELD,
          value: "properties.items.$.item_id",
        },
        target: {
          name: "contents.$.content_id",
        },
      },
      {
        source: {
          type: FieldMappingSourceType.FIELD,
          value: "properties.items.$.price",
        },
        target: {
          name: "contents.$.content_price",
        },
      },
    ];
    const factory = new FieldsMapperFactoryImpl();
    const nowISOString = "2024-03-05T13:41:05.723Z";
    const now = new Date(nowISOString);

    const mapper = factory.newFieldMapper(fieldsMapping, () => now);

    const emailTransformation = jest.fn(() => "example_2@example2.com");
    const emailSecondTransformation = jest.fn(() => "example@example2.com");
    const firstnameTransformation = jest.fn(() => "Hello John");
    const transformationsMap: Record<string, Transformation[]> = {
      email: [emailTransformation, emailSecondTransformation],
      firstname: [firstnameTransformation],
    };

    const sourceEvent = {
      externalIds: {
        email: "Example_2@example2.com",
        firstname: "john",
      },
      lastname: "Doe",
      properties: {
        to_be_mapped: "mapped",
        prop_to_be_added: "added",
        prop_to_be_added2: "added2",
        items: [
          {
            item_id: "SKU_12345",
            price: 90.99,
          },
          {
            item_id: "SKU_12346",
            price: 10.99,
          },
        ],
      },
    };

    const mappedEvent = mapper.mapEvent(sourceEvent, transformationsMap);
    const expectedEvent = {
      email: "example@example2.com",
      prop_example: "mapped",
      firstname: "Hello John",
      lastname: "Hello Doe",
      status: "subscribed",
      timestamp: nowISOString,
      date: nowISOString.split("T")[0],
      prop_to_be_added: "added",
      prop_to_be_added2: "added2",
      contents: [
        {
          content_id: "SKU_12345",
          content_price: 90.99,
        },
        {
          content_id: "SKU_12346",
          content_price: 10.99,
        },
      ],
    };
    expect(mappedEvent).toEqual(expectedEvent);
    expect(emailTransformation).toHaveBeenCalledTimes(1);
    expect(emailSecondTransformation).toHaveBeenCalledTimes(1);
    expect(firstnameTransformation).toHaveBeenCalledTimes(1);

    expect(emailTransformation).toHaveBeenCalledWith("Example_2@example2.com");
    expect(emailSecondTransformation).toHaveBeenCalledWith(
      "example_2@example2.com"
    );
    expect(firstnameTransformation).toHaveBeenCalledWith("Hello john");
  });
});

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

  describe("getEventMapping", () => {
    it("should return the correct mapping for a TRACK event", () => {
      const eventMapper = eventMapperFactory.newEventMapper(eventMappings);
      const mapping = eventMapper.getEventMapping({
        type: JournifyEventType.TRACK,
        event: "test_event",
      });
      expect(mapping).toEqual({
        pixelEventName: "pixel_test_event",
        filters: [],
      });
    });

    it("should return the correct mapping for a PAGE event", () => {
      const eventMapper = eventMapperFactory.newEventMapper(eventMappings);
      const mapping = eventMapper.getEventMapping({
        type: JournifyEventType.PAGE,
        event: "",
      });
      expect(mapping).toEqual({
        pixelEventName: "pixel_page_event",
        filters: [],
      });
    });

    it("should return the correct mapping for a GROUP event", () => {
      const eventMapper = eventMapperFactory.newEventMapper(eventMappings);
      const mapping = eventMapper.getEventMapping({
        type: JournifyEventType.GROUP,
        event: "",
      });
      expect(mapping).toEqual({
        pixelEventName: "pixel_group_event",
        filters: [],
      });
    });

    it("should return the correct mapping for an IDENTIFY event", () => {
      const eventMapper = eventMapperFactory.newEventMapper(eventMappings);
      const mapping = eventMapper.getEventMapping({
        type: JournifyEventType.IDENTIFY,
        event: "",
      });
      expect(mapping).toEqual({
        pixelEventName: "pixel_identify_event",
        filters: [],
      });
    });

    it("should return null for an unsupported event type", () => {
      const eventMapper = eventMapperFactory.newEventMapper(eventMappings);
      const ctx = {
        getEvent: () => ({ type: "UNSUPPORTED_EVENT_TYPE", event: "" }),
      } as unknown as Context;
      const mapping = eventMapper.getEventMapping(ctx.getEvent());
      expect(mapping).toBeNull();
    });
  });
});
