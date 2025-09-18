import { EventFilter, FilterOperator } from "../plugin";
import { getValue } from "./mapping";

export function matchFilters(event: object, filters: EventFilter[]): boolean {
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
