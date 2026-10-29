/**
 * @jest-environment-options {"url": "https://shop.example.co.uk/"}
 */
import JsCookie from "js-cookie";
import { CookiesStore, findRootCookieDomain } from "../cookiesStore";

describe("findRootCookieDomain", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("Should return the widest domain the browser accepts a cookie on", () => {
    expect(findRootCookieDomain("https://shop.example.co.uk/page")).toEqual(
      "example.co.uk"
    );
  });

  it("Should not leave the probe cookie behind", () => {
    findRootCookieDomain("https://shop.example.co.uk/");
    expect(document.cookie).not.toContain("__tld__");
  });

  it("Should return undefined for localhost", () => {
    expect(findRootCookieDomain("http://localhost:3000/")).toBeUndefined();
  });

  it("Should return undefined for an ip address", () => {
    expect(findRootCookieDomain("http://192.168.1.10/")).toBeUndefined();
  });

  it("Should return undefined for an invalid url", () => {
    expect(findRootCookieDomain("not a url")).toBeUndefined();
  });

  it("Should return undefined when no domain accepts the cookie", () => {
    expect(findRootCookieDomain("https://www.other-site.com/")).toBeUndefined();
  });

  it("Should return undefined when cookies cannot be accessed", () => {
    jest.spyOn(JsCookie, "set").mockImplementation(() => {
      throw new Error("sandboxed");
    });
    expect(findRootCookieDomain("https://shop.example.co.uk/")).toBeUndefined();
  });
});

describe("CookiesStore", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    new CookiesStore().remove("key");
  });

  it("Should set cookies on the root domain", () => {
    const set = jest.spyOn(JsCookie, "set");
    new CookiesStore().set("key", "value");

    expect(set).toHaveBeenLastCalledWith(
      "key",
      "value",
      expect.objectContaining({ domain: "example.co.uk" })
    );
    expect(new CookiesStore().get("key")).toEqual("value");
  });

  it("Should use the configured domain without probing", () => {
    const set = jest.spyOn(JsCookie, "set");
    new CookiesStore("shop.example.co.uk").set("key", "value");

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      "key",
      "value",
      expect.objectContaining({ domain: "shop.example.co.uk" })
    );
  });
});
