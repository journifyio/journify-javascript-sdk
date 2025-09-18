/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  no-case-declarations */
import {
  EventMapping,
  FieldMapping,
  FieldMappingSourceType,
  PixelEventMapping,
  TrackingEventType,
} from "../plugin";
import _ from "lodash";
import { Liquid, Template } from "liquidjs";
import { applyTransformations, Transformation } from "./tranformations";
import {
  JournifyDefaultEvent,
  JournifyEvent,
  JournifyEventType,
} from "../../../domain/event";
import * as uuid from "uuid";

const CURRENT_DATE_VAR_NAME = "CURRENT_DATE";
const CURRENT_TIME_VAR_NAME = "CURRENT_TIME";
const UUID_VAR_NAME = "UUID";
const EVENT_TEMPLATING_KEY = "record";
const ARRAY_PATH_SEPARATOR = ".$";

export interface FieldsMapperFactory {
  newFieldMapper(fieldMappings: FieldMapping[], now?: () => Date): FieldsMapper;
}

export interface FieldsMapper {
  mapEvent(
    event: object,
    transformationsMap?: Record<string, Transformation[]>,
    options?: { ignoreUnmappedProperties: boolean }
  ): Record<string, any>;
}

export class FieldsMapperFactoryImpl implements FieldsMapperFactory {
  public newFieldMapper(
    fieldMappings: FieldMapping[],
    now: () => Date = () => new Date()
  ): FieldsMapper {
    return new FieldsMapperImpl(fieldMappings, now);
  }
}

class FieldsMapperImpl implements FieldsMapper {
  private readonly fieldMappings: FieldMapping[];
  private readonly templateCache: Record<string, Template[]>;
  private readonly liquidEngine: Liquid;
  private readonly now: () => Date;

  constructor(fieldMappings: FieldMapping[], now: () => Date) {
    this.fieldMappings = fieldMappings;
    this.now = now;
    this.liquidEngine = new Liquid();

    this.templateCache = {};
    for (const mapping of this.fieldMappings) {
      if (mapping.source.type == FieldMappingSourceType.TEMPLATE) {
        const tpl = this.liquidEngine.parse(mapping.source.value);
        this.templateCache[mapping.target.name] = tpl;
      }
    }
  }

  public mapEvent(
    event: object,
    transformationsMap?: Record<string, Transformation[]>,
    options: { ignoreUnmappedProperties: boolean } = {
      ignoreUnmappedProperties: false,
    }
  ): Record<string, any> {
    if (!event || Object.keys(event).length === 0) {
      return {};
    }

    const excludedProperties = new Set<string>();

    let properties = {};
    for (const mapping of this.fieldMappings) {
      let value = null;
      switch (mapping.source.type) {
        case FieldMappingSourceType.FIELD:
          value = getValue(event, mapping.source.value);
          const excludeProp = mapping.source.value.startsWith("properties.");
          if (excludeProp && isArrayPath(mapping.source.value)) {
            excludedProperties.add(
              mapping.source.value.split(ARRAY_PATH_SEPARATOR)[0]
            );
          } else if (excludeProp) {
            excludedProperties.add(mapping.source.value);
          }

          break;

        case FieldMappingSourceType.TEMPLATE:
          value = this.liquidEngine.renderSync(
            this.templateCache[mapping.target.name],
            {
              [EVENT_TEMPLATING_KEY]: event,
            }
          );
          break;

        case FieldMappingSourceType.CONSTANT:
          value = mapping.source.value;
          break;

        case FieldMappingSourceType.VARIABLE:
          value = this.mapVariableValue(mapping);
          break;
      }

      if (
        value &&
        transformationsMap &&
        transformationsMap[mapping.target.name]
      ) {
        value = applyTransformations(
          value,
          transformationsMap[mapping.target.name]
        );
      }

      if (value) {
        properties = setValue(properties, mapping.target.name, value);
      }
    }

    if (options.ignoreUnmappedProperties) {
      return properties;
    }

    const eventProps = event["properties"];
    if (eventProps) {
      for (const key in eventProps) {
        if (!excludedProperties.has("properties." + key)) {
          properties[key] = eventProps[key];
        }
      }
    }

    return properties;
  }

  private mapVariableValue(mapping: FieldMapping): string {
    switch (mapping.source.value) {
      case CURRENT_DATE_VAR_NAME:
        return this.getCurrentUtcDate();

      case CURRENT_TIME_VAR_NAME:
        return this.getCurrentUtcTime();
      case UUID_VAR_NAME:
        return uuid.v4();
    }

    return "";
  }

  private getCurrentUtcDate(): string {
    const currentDate = this.now();
    const year = currentDate.getUTCFullYear();
    const month = String(currentDate.getUTCMonth() + 1).padStart(2, "0"); // Months are 0-indexed
    const day = String(currentDate.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getCurrentUtcTime(): string {
    const now = this.now();
    return now.toISOString();
  }
}

export interface EventMapperFactory {
  newEventMapper(eventMappings: EventMapping[]): EventMapper;
}

export interface EventMapper {
  getEventMapping(event: JournifyEvent): PixelEventMapping | null;
}

export class EventMapperFactoryImpl implements EventMapperFactory {
  public newEventMapper(eventMappings: EventMapping[]): EventMapper {
    return new EventMapperImpl(eventMappings);
  }
}

export class EventMapperImpl implements EventMapper {
  private readonly eventMappings: EventMapping[];
  private readonly pageEventsMapping: Record<string, PixelEventMapping> = {};
  private readonly trackEventsMapping: Record<string, PixelEventMapping> = {};
  private readonly groupEventsMapping: Record<string, PixelEventMapping> = {};
  private readonly identifyEventsMapping: Record<string, PixelEventMapping> =
    {};

  constructor(eventMappings: EventMapping[]) {
    this.eventMappings = eventMappings;
    this.init();
  }

  public getEventMapping(event: JournifyEvent): PixelEventMapping | null {
    switch (event.type) {
      case JournifyEventType.TRACK:
        return this.trackEventsMapping[event.event];
      case JournifyEventType.PAGE:
        return this.pageEventsMapping[event.event || JournifyDefaultEvent.PAGE];
      case JournifyEventType.GROUP:
        return this.groupEventsMapping[
          event.event || JournifyDefaultEvent.GROUP
        ];
      case JournifyEventType.IDENTIFY:
        return this.identifyEventsMapping[
          event.event || JournifyDefaultEvent.IDENTIFY
        ];
      default:
        return null;
    }
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
          this.trackEventsMapping[mapping.event_name] = pixelMapping;
          break;

        case TrackingEventType.PAGE_EVENT:
          this.pageEventsMapping[JournifyDefaultEvent.PAGE] = pixelMapping;
          break;

        case TrackingEventType.GROUP_EVENT:
          this.groupEventsMapping[JournifyDefaultEvent.GROUP] = pixelMapping;
          break;

        case TrackingEventType.IDENTIFY_EVENT:
          this.identifyEventsMapping[JournifyDefaultEvent.IDENTIFY] =
            pixelMapping;
          break;
      }
    }
  }
}

export function getValue(obj: object, path: string): any {
  if (isArrayPath(path)) {
    return getValues(obj, path);
  }

  return _.get(obj, path);
}

function isArrayPath(path: string): boolean {
  return path.includes(ARRAY_PATH_SEPARATOR);
}

function getValues(data: { [key: string]: any }, path: string): any {
  const pathParts = path.split(ARRAY_PATH_SEPARATOR);
  const size = pathParts.length;

  // Return false if the path is invalid (no .$ found or more than one .$ found)
  if (size === 0 || size > 2) {
    return null;
  }

  // Get the array value from the data
  const arrayPath = pathParts[0];
  const value = getValue(data, arrayPath);
  if (!value) {
    return value;
  }

  // If the returned value is not an array, return false
  if (!Array.isArray(value)) {
    return null;
  }

  // If there is no nested path, return the array as is
  if (size === 1 || pathParts[1] === "") {
    return value;
  }

  // Get the nested path values
  const nestedPath = pathParts[1].substring(1);
  const values: any[] = [];
  let keyFound = false;

  for (const v of value) {
    const nestedValue = getValue(v, nestedPath);
    if (nestedValue !== undefined) {
      values.push(nestedValue);
      keyFound = true;
    } else {
      // Append null to keep the array size consistent with the original array
      values.push(null);
    }
  }

  if (!keyFound || values.length === 0) {
    return null;
  }

  return values;
}

function setValue(obj: object, path: string, value: any): object {
  if (isArrayPath(path)) {
    return setValues(obj, path, value);
  }

  return _.set(obj, path, value);
}

function setValues(obj: object, key: string, sourceValue: any): object {
  const pathParts = key.split(ARRAY_PATH_SEPARATOR);
  const size = pathParts.length;
  // Return if the path is invalid (equals to .$, no .$ found or more than one .$ found)
  if (size === 0 || size > 2 || key === ARRAY_PATH_SEPARATOR) {
    return obj;
  }

  // If there is no nested path, replace the array with the source value
  const arrayPath = pathParts[0];
  if (size === 1 || pathParts[1] === "") {
    return setValue(obj, arrayPath, sourceValue);
  }

  // Get the array value from the record
  let value = getValue(obj, arrayPath);
  // Create the array if it doesn't exist
  if (value === undefined) {
    value = [];
  }

  // Do nothing if the returned value is not an array (when the key points to a non-array field)
  if (!Array.isArray(value)) {
    return obj;
  }
  const array = value;
  const arraySize = array.length;
  // Set the nested path values (remove the first character which is a dot)
  const nestedPath = pathParts[1].substring(1);
  // Check if sourceValue is an array
  if (Array.isArray(sourceValue)) {
    for (let i = 0; i < sourceValue.length; i++) {
      // Expand the array if needed
      if (i >= arraySize) {
        array.push({});
      }

      // Set nested values
      if (typeof array[i] === "object" && !Array.isArray(array[i])) {
        array[i] = setValue(array[i], nestedPath, sourceValue[i]);
      }
    }
  } else {
    if (arraySize === 0) {
      array.push({});
    }

    for (let i = 0; i < array.length; i++) {
      if (typeof array[i] === "object" && !Array.isArray(array[i])) {
        array[i] = setValue(array[i], nestedPath, sourceValue);
      }
    }
  }

  return setValue(obj, arrayPath, array);
}
