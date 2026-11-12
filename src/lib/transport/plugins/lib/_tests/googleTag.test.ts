import { googleTagScriptURL } from "../googleTag";

describe("googleTagScriptURL", () => {
  it.each([undefined, "", "   ", "/", "//"])(
    "should load from Google's domain when the gateway path is %p",
    (gatewayPath) => {
      expect(googleTagScriptURL({ tagID: "AW-123", gatewayPath })).toEqual(
        "https://www.googletagmanager.com/gtag/js?id=AW-123"
      );
    }
  );

  it("should add the data layer name when loading from Google's domain", () => {
    expect(
      googleTagScriptURL({ tagID: "G-123", dataLayerName: "JDataLayer" })
    ).toEqual("https://www.googletagmanager.com/gtag/js?id=G-123&l=JDataLayer");
  });

  it.each(["/metrics", "/metrics/", "metrics", " /metrics// "])(
    "should load from the gateway path %p without the tag ID",
    (gatewayPath) => {
      expect(googleTagScriptURL({ tagID: "AW-123", gatewayPath })).toEqual(
        "/metrics/"
      );
    }
  );

  it("should keep nested gateway paths", () => {
    expect(
      googleTagScriptURL({ tagID: "AW-123", gatewayPath: "/a/b" })
    ).toEqual("/a/b/");
  });

  it("should add the data layer name when loading from the gateway path", () => {
    expect(
      googleTagScriptURL({
        tagID: "G-123",
        gatewayPath: "/metrics",
        dataLayerName: "JDataLayer",
      })
    ).toEqual("/metrics/?l=JDataLayer");
  });

  it("should keep an absolute gateway URL", () => {
    expect(
      googleTagScriptURL({
        tagID: "G-123",
        gatewayPath: "https://example.com/metrics/",
      })
    ).toEqual("https://example.com/metrics/");
  });
});
