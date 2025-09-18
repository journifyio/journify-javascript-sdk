import { hashPII } from "../hashPII";

// Mock the PII_KEYS Set
global.PII_KEYS = new Set(["email", "phone"]);

describe("hashPII", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should hash PII fields", async () => {
    const input = {
      email: "test@example.com",
      phone: "1234567890",
      name: "John Doe",
    };

    const result = await hashPII(input);

    expect(result).toEqual({
      email: "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b",
      phone: "c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646",
      name: "94890005f3b2117a353da7260259531878cae4f541bf59998511887d1f0221a5",
    });
  });

  it("should convert PII fields to lowercase before hashing", async () => {
    const input = {
      email: "TEST@EXAMPLE.COM",
    };

    const result = await hashPII(input);

    expect(result).toEqual({
      email: "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b",
    });
  });

  it("should not hash non-PII fields", async () => {
    const input = {
      name: "John Doe",
      age: 30,
    };

    const result = await hashPII(input);

    expect(result).toEqual({
      name: "94890005f3b2117a353da7260259531878cae4f541bf59998511887d1f0221a5",
      age: 30,
    });
  });

  it("should handle empty objects", async () => {
    const input = {};

    const result = await hashPII(input);

    expect(result).toEqual({});
  });

  it("should handle null and undefined values", async () => {
    const input = {
      email: null,
      phone: undefined,
      name: "John Doe",
    };

    const result = await hashPII(input);

    expect(result).toEqual({
      email: null,
      phone: undefined,
      name: "94890005f3b2117a353da7260259531878cae4f541bf59998511887d1f0221a5",
    });
  });
});
