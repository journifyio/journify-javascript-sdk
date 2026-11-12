import { DEFAULT_API_HOST, getRegionApiHosts, isJournifyAPIHost, resolveApiHost } from "../region";

describe("resolveApiHost", () => {
  it.each([
    [undefined, undefined, "https://t.journify.io"],
    [undefined, "us", "https://t.journify.io"],
    [undefined, "eu", "https://t-eu.journify.io"],
    [undefined, "ksa", "https://t-ksa.journify.io"],
    [undefined, " EU ", "https://t-eu.journify.io"],
    [undefined, "unknown", "https://t.journify.io"],
    ["https://t.journify.io", "eu", "https://t-eu.journify.io"],
    ["https://t-ksa.journify.io", undefined, "https://t.journify.io"],
    ["https://t.customer.com", "eu", "https://t.customer.com"],
    ["https://t.customer.com", undefined, "https://t.customer.com"],
    ["https://t-eu.customer.com", "eu", "https://t-eu.customer.com"],
    ["https://t-ksa.customer.com", undefined, "https://t-ksa.customer.com"],
    ["https://t.journify.dev", "eu", "https://t-eu.journify.dev"],
    ["https://t-eu.journify.dev", "ksa", "https://t-ksa.journify.dev"],
    ["https://t.journify.dev", undefined, "https://t.journify.dev"],
    ["https://t.journify.dev", "unknown", "https://t.journify.dev"],
    ["https://t.lvh.me", "eu", "https://t.lvh.me"],
    ["http://t.journify.io", "eu", "http://t.journify.io"],
    ["https://t.journify.dev:8443", "eu", "https://t.journify.dev:8443"],
  ])("apiHost=%s region=%s -> %s", (apiHost, region, expected) => {
    expect(resolveApiHost(apiHost, region)).toBe(expected);
  });

  it("builds the region hosts for a domain", () => {
    expect(getRegionApiHosts("journify.dev")).toEqual({
      us: "https://t.journify.dev",
      eu: "https://t-eu.journify.dev",
      ksa: "https://t-ksa.journify.dev",
    });
  });

  it("defaults to the us host", () => {
    expect(DEFAULT_API_HOST).toBe("https://t.journify.io");
  });
});

describe("isJournifyAPIHost", () => {
  it.each([
    ["https://t.journify.io", true],
    ["https://t-eu.journify.io", true],
    ["https://t-ksa.journify.io/", true],
    ["https://t.journify.dev", false],
    ["https://t-eu.journify.dev", false],
    ["https://static.journify.io", false],
    ["https://t.journify.io.evil.com", false],
    ["http://t.journify.io", false],
    ["https://t.journify.io:8443", false],
    ["https://t.customer.com", false],
    ["not a url", false],
  ])("%s -> %s", (host, expected) => {
    expect(isJournifyAPIHost(host)).toBe(expected);
  });
});
