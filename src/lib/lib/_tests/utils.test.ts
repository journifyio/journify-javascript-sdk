import { normalizePhone, removeEmptyStrings } from "../utils"; // Replace with the actual path to your function

describe("normalizePhone", () => {
  it("should format number with parentheses and dashes", () => {
    expect(normalizePhone("(123) 456-7890", "1")).toBe("11234567890");
  });

  it("should format number with spaces", () => {
    expect(normalizePhone("123 456 7890", "1")).toBe("11234567890");
  });

  it("should return number already in E.164 format", () => {
    expect(normalizePhone("11234567890", "1")).toBe("11234567890");
  });

  it("should add country code to a number without it", () => {
    expect(normalizePhone("1234567890", "1")).toBe("11234567890");
  });

  it("should format a UK number without country code", () => {
    expect(normalizePhone("07123456789", "44")).toBe("447123456789");
  });

  it("should keep a number if country code included", () => {
    expect(normalizePhone("441234567890", "44")).toBe("441234567890");
  });

  it("should format a number with extra characters (international number)", () => {
    expect(normalizePhone("(44) 7123 456789", "44")).toBe("447123456789");
  });

  it("should not change a hashed phone number", () => {
    expect(
      normalizePhone(
        "cd96b86774cc053895742441dc817f5428c79aee8f34fa0786f8c5de80e164fe",
        "966"
      )
    ).toBe("cd96b86774cc053895742441dc817f5428c79aee8f34fa0786f8c5de80e164fe");
  });

  it("should format a number that starts with country code", () => {
    expect(normalizePhone("911234567890", "91")).toBe("911234567890");
  });

  it("should format a number with dots as separators", () => {
    expect(normalizePhone("123.456.7890", "1")).toBe("11234567890");
  });

  it("should ignore alphabetic characters in phone number", () => {
    expect(normalizePhone("(123) abc-4567", "1")).toBe("11234567");
  });
});

describe("removeEmptyStrings", () => {
  it("should remove any empty strings from an object", () => {
    const testCases = [
      {
        input: { name: "John Doe", email: "", phone: "1234567890" },
        expected: { name: "John Doe", phone: "1234567890" },
      },
      {
        input: null,
        expected: {},
      },
      {
        input: undefined,
        expected: {},
      },
      {
        input: { name: "", email: "", phone: "" },
        expected: {},
      },
      {
        input: { hello: "world", foo: "bar" },
        expected: { hello: "world", foo: "bar" },
      },
    ];
    testCases.forEach((testCase) => {
      expect(removeEmptyStrings(testCase.input)).toEqual(testCase.expected);
    });
  });
});
