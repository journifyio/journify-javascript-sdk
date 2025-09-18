import { matchFilters } from "../filters";
import { EventFilter, FilterOperator } from "../../plugin";

describe("matchFilters function", () => {
  it("should return true if no filters are provided", () => {
    const result = matchFilters({}, []);
    expect(result).toBe(true);
  });

  it("should return true if all filters match", () => {
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
        field: "field.subfield",
        operator: FilterOperator.CONTAINS,
        value: "Unix",
      },
      {
        field: "field.subfield",
        operator: FilterOperator.NOT_CONTAINS,
        value: "Linux",
      },
      {
        field: "field2.subfield2",
        operator: FilterOperator.NOT_CONTAINS,
        value: "Unix",
      },
      {
        field: "field2.subfield2",
        operator: FilterOperator.CONTAINS,
        value: "Linux",
      },
      {
        field: "event",
        operator: FilterOperator.STARTS_WITH,
        value: "Add",
      },
      {
        field: "event",
        operator: FilterOperator.ENDS_WITH,
        value: "Cart",
      },
      {
        field: "properties.amount",
        operator: FilterOperator.GREATER_THAN,
        value: 1000,
      },
      {
        field: "value",
        operator: FilterOperator.GREATER_THAN_OR_EQ,
        value: 2039.7,
      },
      {
        field: "quantity",
        operator: FilterOperator.LESS_THAN,
        value: 5,
      },
      {
        field: "orders",
        operator: FilterOperator.LESS_THAN_OR_EQ,
        value: 10000002,
      },
    ];
    const event = {
      context: {
        page: {
          url: "https://www.example.com",
          title: "Hello Journify",
        },
      },
      field: {
        subfield: "Unix is great",
      },
      field2: {
        subfield2: "Linux is great",
      },
      event: "Add product to Cart",
      properties: {
        amount: 1001,
      },
      value: 2039.7,
      quantity: 4,
      orders: 10000002,
    };
    const result = matchFilters(event, filters);
    expect(result).toBe(true);
  });

  it("should return false if a string filter does not match", () => {
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
        field: "field.subfield",
        operator: FilterOperator.CONTAINS,
        value: "Unix",
      },
    ];
    const event = {
      context: {
        page: {
          url: "https://www.example.com",
          title: "Hello world",
        },
      },
      field: {
        subfield: "Unix is great",
      },
      field2: {
        subfield2: "Linux is great",
      },
      event: "Add product to Cart",
      properties: {
        amount: 1001,
      },
      value: 2039.7,
      quantity: 4,
      orders: 10000002,
    };
    const result = matchFilters(event, filters);
    expect(result).toBe(false);
  });

  it("should return false if a number filter does not match", () => {
    const filters: EventFilter[] = [
      {
        field: "properties.amount",
        operator: FilterOperator.GREATER_THAN,
        value: 1000,
      },
      {
        field: "value",
        operator: FilterOperator.GREATER_THAN_OR_EQ,
        value: 2039.7,
      },
      {
        field: "quantity",
        operator: FilterOperator.LESS_THAN,
        value: 5,
      },
      {
        field: "orders",
        operator: FilterOperator.LESS_THAN_OR_EQ,
        value: 10000002,
      },
    ];
    const event = {
      context: {
        page: {
          url: "https://www.example.com",
          title: "Hello Journify",
        },
      },
      field: {
        subfield: "Unix is great",
      },
      field2: {
        subfield2: "Linux is great",
      },
      event: "Add product to Cart",
      properties: {
        amount: 1001,
      },
      value: 2039,
      quantity: 4,
      orders: 10000002,
    };
    const result = matchFilters(event, filters);
    expect(result).toBe(false);
  });
});
