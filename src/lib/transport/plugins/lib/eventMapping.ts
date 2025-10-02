import {EventFilter, EventMapping, FilterOperator, PixelEventMapping, TrackingEventType} from "../plugin";
import {JournifyDefaultEvent, JournifyEvent, JournifyEventType, MappedEvent} from "../../../domain/event";
import {getValue} from "./value";

export interface EventMapperFactory {
    newEventMapper(eventMappings: EventMapping[]): EventMapper;
}

export interface EventMapper {
    applyEventMapping(event: JournifyEvent): MappedEvent | null;
}

export class EventMapperFactoryImpl implements EventMapperFactory {
    public newEventMapper(eventMappings: EventMapping[]): EventMapper {
        return new EventMapperImpl(eventMappings);
    }
}

export class EventMapperImpl implements EventMapper {
    private readonly eventMappings: EventMapping[];
    private readonly pageEventsMapping: Record<string, PixelEventMapping[]> = {};
    private readonly trackEventsMapping: Record<string, PixelEventMapping[]> = {};
    private readonly groupEventsMapping: Record<string, PixelEventMapping[]> = {};
    private readonly identifyEventsMapping: Record<string, PixelEventMapping[]> =
        {};

    constructor(eventMappings: EventMapping[]) {
        this.eventMappings = eventMappings;
        this.init();
    }

    public applyEventMapping(event: JournifyEvent): MappedEvent | null {
        let eventMappings: PixelEventMapping[];
        switch (event.type) {
            case JournifyEventType.TRACK:
                eventMappings = this.trackEventsMapping[event.event];
                break;
            case JournifyEventType.PAGE:
                eventMappings = this.pageEventsMapping[event.event || JournifyDefaultEvent.PAGE];
                break;
            case JournifyEventType.GROUP:
                eventMappings = this.groupEventsMapping[
                event.event || JournifyDefaultEvent.GROUP
                    ];
                break;
            case JournifyEventType.IDENTIFY:
                eventMappings = this.identifyEventsMapping[
                event.event || JournifyDefaultEvent.IDENTIFY
                    ];
                break;
            default:
                return null;
        }

        if (!eventMappings || eventMappings.length === 0) {
            return null;
        }

        for (const mapping of eventMappings) {
            if (matchFilters(event, mapping.filters)) {
                return {
                    pixelEventName: mapping.pixelEventName,
                };
            }
        }

        return null;
    }

    private init(): void {
        for (const mapping of this.eventMappings) {
            if (!mapping.enabled) {
                continue;
            }

            const pixelMapping: PixelEventMapping = {
                pixelEventName: mapping.destination_event_key,
                filters: mapping.filters,
            };

            switch (mapping.event_type) {
                case TrackingEventType.TRACK_EVENT:
                    if (!this.trackEventsMapping[mapping.event_name]){
                        this.trackEventsMapping[mapping.event_name] = [];
                    }
                    this.trackEventsMapping[mapping.event_name].push(pixelMapping);
                    break;

                case TrackingEventType.PAGE_EVENT:
                    if (!this.pageEventsMapping[JournifyDefaultEvent.PAGE]){
                        this.pageEventsMapping[JournifyDefaultEvent.PAGE] = [];
                    }
                    this.pageEventsMapping[JournifyDefaultEvent.PAGE].push(pixelMapping);
                    break;

                case TrackingEventType.GROUP_EVENT:
                    if (!this.groupEventsMapping[JournifyDefaultEvent.GROUP]){
                        this.groupEventsMapping[JournifyDefaultEvent.GROUP] = [];
                    }
                    this.groupEventsMapping[JournifyDefaultEvent.GROUP].push(pixelMapping);
                    break;

                case TrackingEventType.IDENTIFY_EVENT:
                    if (!this.identifyEventsMapping[JournifyDefaultEvent.IDENTIFY]){
                        this.identifyEventsMapping[JournifyDefaultEvent.IDENTIFY] = [];
                    }
                    this.identifyEventsMapping[JournifyDefaultEvent.IDENTIFY].push(pixelMapping);
                    break;
            }
        }
    }
}

function matchFilters(event: object, filters: EventFilter[]): boolean {
    if (filters) {
        for (const filter of filters) {
            if (!matchFilter(event, filter)) {
                return false;
            }
        }
    }

    return true;
}

function matchFilter(event: object, filter: EventFilter): boolean {
    const eventValue = getValue(event, filter.field);
    switch (filter.operator) {
        case FilterOperator.EQUALS:
            if (filter.value === eventValue) {
                return true;
            }

            return filter.value?.includes(eventValue);

        case FilterOperator.NOT_EQUALS:
            return filter.value !== eventValue;

        case FilterOperator.CONTAINS:
            return eventValue?.includes(filter.value);

        case FilterOperator.NOT_CONTAINS:
            return !eventValue?.includes(filter.value);

        case FilterOperator.STARTS_WITH:
            return eventValue?.startsWith(filter.value);

        case FilterOperator.ENDS_WITH:
            return eventValue?.endsWith(filter.value);

        case FilterOperator.GREATER_THAN:
            return eventValue > filter.value;

        case FilterOperator.GREATER_THAN_OR_EQ:
            return eventValue >= filter.value;

        case FilterOperator.LESS_THAN:
            return eventValue < filter.value;

        case FilterOperator.LESS_THAN_OR_EQ:
            return eventValue <= filter.value;
    }

    return false;
}