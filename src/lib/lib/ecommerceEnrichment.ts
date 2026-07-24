import { JournifyEvent } from "../domain/event";

export type EcommerceItem = {
  value?: string | number;
  currency?: string;
  brand?: string;
  name?: string;
  id?: string | number;
  category?: string;
};

const ENRICHED_FIELDS: (keyof EcommerceItem)[] = [
  "value",
  "currency",
  "brand",
  "name",
  "id",
  "category",
];

export function extractEcommerceItems(document: Document): EcommerceItem[] {
  const items: EcommerceItem[] = [];

  document
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach((script) => {
      try {
        visitJsonLd(JSON.parse(script.textContent || ""), items);
      } catch {
        // Ignore malformed structured data from the host page.
      }
    });

  document.querySelectorAll("[itemscope][itemtype]").forEach((element) => {
    if (hasType(element, "Product")) {
      addItem(items, microdataProduct(element));
    }
  });

  return items;
}

export function enrichEventItems(
  event: JournifyEvent,
  ecommerceItems: EcommerceItem[]
): void {
  const items = event.properties?.items;
  if (!Array.isArray(items) || ecommerceItems.length === 0) {
    return;
  }

  items.forEach((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }

    const identifier =
      item.id ?? item.item_id ?? item.product_id ?? item.sku;
    const source =
      ecommerceItems.length === 1
        ? ecommerceItems[0]
        : ecommerceItems.find(
            (candidate) =>
              identifier != null &&
              candidate.id != null &&
              String(candidate.id) === String(identifier)
          );

    if (!source) {
      return;
    }

    ENRICHED_FIELDS.forEach((field) => {
      if (isMissing(item[field]) && !isMissing(source[field])) {
        item[field] = source[field];
      }
    });
  });
}

function visitJsonLd(value: unknown, items: EcommerceItem[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => visitJsonLd(entry, items));
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  if (hasJsonType(value, "Product")) {
    addItem(items, jsonProduct(value));
    return;
  }

  Object.keys(value).forEach((key) => visitJsonLd(value[key], items));
}

function jsonProduct(product: Record<string, unknown>): EcommerceItem {
  const offer = firstRecord(product.offers);
  return {
    value: scalar(offer?.price ?? offer?.lowPrice),
    currency: stringValue(offer?.priceCurrency),
    brand: namedValue(product.brand),
    name: stringValue(product.name),
    id: scalar(product.sku ?? product.productID ?? product["@id"]),
    category: namedValue(product.category),
  };
}

function microdataProduct(product: Element): EcommerceItem {
  const offer = Array.from(
    product.querySelectorAll("[itemscope][itemtype]")
  ).find((element) => hasType(element, "Offer"));

  return {
    value: propertyValue(offer, "price") ?? propertyValue(offer, "lowPrice"),
    currency: propertyValue(offer, "priceCurrency"),
    brand: propertyValue(product, "brand"),
    name: propertyValue(product, "name"),
    id:
      propertyValue(product, "sku") ??
      propertyValue(product, "productID") ??
      product.getAttribute("itemid") ??
      undefined,
    category: propertyValue(product, "category"),
  };
}

function propertyValue(
  scope: Element | undefined,
  property: string
): string | undefined {
  if (!scope) return undefined;

  const element = Array.from(
    scope.querySelectorAll(`[itemprop~="${property}"]`)
  ).find((candidate) => {
    const owner = candidate.hasAttribute("itemscope")
      ? candidate.parentElement?.closest("[itemscope]")
      : candidate.closest("[itemscope]");
    return owner === scope;
  });

  if (!element) return undefined;
  return (
    element.getAttribute("content") ??
    element.getAttribute("value") ??
    element.getAttribute("href") ??
    element.textContent?.trim() ??
    undefined
  );
}

function addItem(items: EcommerceItem[], item: EcommerceItem): void {
  if (!ENRICHED_FIELDS.some((field) => !isMissing(item[field]))) return;

  const existing =
    item.id == null
      ? undefined
      : items.find(
          (candidate) =>
            candidate.id != null && String(candidate.id) === String(item.id)
        );

  if (!existing) {
    items.push(item);
    return;
  }

  ENRICHED_FIELDS.forEach((field) => {
    if (isMissing(existing[field]) && !isMissing(item[field])) {
      Object.assign(existing, { [field]: item[field] });
    }
  });
}

function hasType(element: Element, type: string): boolean {
  return (element.getAttribute("itemtype") || "")
    .split(/\s+/)
    .some((value) => value === type || value.endsWith(`/${type}`));
}

function hasJsonType(value: Record<string, unknown>, type: string): boolean {
  const types = Array.isArray(value["@type"])
    ? value["@type"]
    : [value["@type"]];
  return types.some(
    (entry) =>
      typeof entry === "string" &&
      (entry === type || entry.endsWith(`/${type}`))
  );
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return isRecord(first) ? first : undefined;
}

function namedValue(value: unknown): string | undefined {
  return isRecord(value) ? stringValue(value.name) : stringValue(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function scalar(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number"
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isMissing(value: unknown): boolean {
  return value == null || value === "";
}
