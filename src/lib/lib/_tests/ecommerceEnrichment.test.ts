import {
  enrichEventItems,
  extractEcommerceItems,
} from "../ecommerceEnrichment";
import { JournifyEventType } from "../../domain/event";

describe("ecommerce enrichment", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("extracts and combines Product data from JSON-LD and microdata", () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
        {
          "@type": "Product",
          "sku": "sku-1",
          "name": "Running Shoe",
          "brand": {"name": "Journify"},
          "offers": {"@type": "Offer", "price": 99, "priceCurrency": "AED"}
        }
      </script>
      <div itemscope itemtype="https://schema.org/Product">
        <meta itemprop="sku" content="sku-1" />
        <meta itemprop="category" content="Shoes" />
      </div>
    `;

    expect(extractEcommerceItems(document)).toEqual([
      {
        id: "sku-1",
        name: "Running Shoe",
        brand: "Journify",
        value: 99,
        currency: "AED",
        category: "Shoes",
      },
    ]);
  });

  it("fills missing item fields without replacing event values", () => {
    const event = {
      type: JournifyEventType.TRACK,
      properties: {
        items: [{ id: "sku-1", name: "Event name" }],
      },
    };

    enrichEventItems(event, [
      {
        id: "sku-1",
        name: "Page name",
        brand: "Journify",
        value: 99,
        currency: "AED",
        category: "Shoes",
      },
    ]);

    expect(event.properties.items).toEqual([
      {
        id: "sku-1",
        name: "Event name",
        brand: "Journify",
        value: 99,
        currency: "AED",
        category: "Shoes",
      },
    ]);
  });

  it("matches IDs when the page contains multiple products", () => {
    const event = {
      type: JournifyEventType.TRACK,
      properties: {
        items: [{ item_id: "sku-2" }, { name: "No ID" }],
      },
    };

    enrichEventItems(event, [
      { id: "sku-1", brand: "First" },
      { id: "sku-2", brand: "Second" },
    ]);

    expect(event.properties.items).toEqual([
      { item_id: "sku-2", id: "sku-2", brand: "Second" },
      { name: "No ID" },
    ]);
  });

  it("ignores standalone Offer fields while keeping its nested Product", () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
        {
          "@type": "Offer",
          "price": "25.00",
          "priceCurrency": "USD",
          "itemOffered": {
            "@type": "Product",
            "productID": "product-1",
            "name": "T-shirt",
            "category": "Apparel"
          }
        }
      </script>
    `;

    expect(extractEcommerceItems(document)).toEqual([
      {
        id: "product-1",
        name: "T-shirt",
        category: "Apparel",
        brand: undefined,
        value: undefined,
        currency: undefined,
      },
    ]);
  });
});
