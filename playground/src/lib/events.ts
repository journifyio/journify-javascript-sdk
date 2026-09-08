const SAMPLE_ITEMS = [
  {
    item_id: "SKU_12345",
    item_name: "Stan and Friends Tee",
    item_brand: "Google",
    item_category: "Apparel",
    price: 10.01,
    quantity: 3,
  },
  {
    item_id: "SKU_12346",
    item_name: "Google Grey Women's Tee",
    item_brand: "Google",
    item_category: "Apparel",
    price: 21.01,
    quantity: 1,
  },
];

export interface EventDefinition {
  key: string;
  label: string;
  kind: "page" | "track" | "identify";
  // For track: event properties. For page: page properties. For identify: traits.
  defaultPayload: object;
}

export const EVENT_DEFINITIONS: EventDefinition[] = [
  {
    key: "identify",
    label: "identify",
    kind: "identify",
    defaultPayload: {
      userId: "user_12345",
      traits: {
        email: "jane.doe@example.com",
        phone: "+212612345678",
        firstname: "Jane",
        lastname: "Doe",
      },
    },
  },
  {
    key: "page_view",
    label: "page",
    kind: "page",
    defaultPayload: {
      name: "Home",
      properties: {
        title: "Journify Playground",
        path: "/",
      },
    },
  },
  {
    key: "view_item",
    label: "view_item",
    kind: "track",
    defaultPayload: {
      currency: "USD",
      value: 10.01,
      items: [SAMPLE_ITEMS[0]],
    },
  },
  {
    key: "add_to_cart",
    label: "add_to_cart",
    kind: "track",
    defaultPayload: {
      currency: "USD",
      value: 30.03,
      items: [SAMPLE_ITEMS[0]],
    },
  },
  {
    key: "begin_checkout",
    label: "begin_checkout",
    kind: "track",
    defaultPayload: {
      currency: "USD",
      value: 51.04,
      coupon: "SUMMER_FUN",
      items: SAMPLE_ITEMS,
    },
  },
  {
    key: "purchase",
    label: "purchase",
    kind: "track",
    defaultPayload: {
      transaction_id: "T_RANDOMIZED_PER_CLICK",
      currency: "USD",
      value: 55.24,
      tax: 3.6,
      shipping: 5.99,
      coupon: "SUMMER_FUN",
      items: SAMPLE_ITEMS,
    },
  },
];

export function randomTransactionId(): string {
  return `T_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
