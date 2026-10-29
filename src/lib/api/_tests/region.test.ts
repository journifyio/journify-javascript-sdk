import { DEFAULT_API_HOST, isJournifyAPIHost, resolveApiHost } from "../region";

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
  ])("apiHost=%s region=%s -> %s", (apiHost, region, expected) => {
    expect(resolveApiHost(apiHost, region)).toBe(expected);
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
    ["https://t.customer.com", false],
    ["not a url", false],
  ])("%s -> %s", (host, expected) => {
    expect(isJournifyAPIHost(host)).toBe(expected);
  });
});
