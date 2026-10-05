import { toMinorUnits } from "../utils";

describe("OpenAI Pixel utils", () => {
  describe("toMinorUnits", () => {
    it.each([
      [0, "USD", 0],
      [0, "JPY", 0],
      ["0", "KWD", 0],
      [19.99, "USD", 1999],
      ["7.875", "KWD", 7875],
      [7.875, "USD", 788],
      [123.45678, "CLF", 1234568],
      [123.4, "JPY", 123],
    ])("normalizes %p %s to %p", (value, currency, expected) => {
      expect(toMinorUnits(value, currency)).toBe(expected);
    });

    it.each([
      [12.34, undefined],
      [12.34, null],
      [12.34, ""],
      [12.34, "   "],
      [12.34, "XXX"],
      ["abc", "USD"],
      [null, "USD"],
      [undefined, "USD"],
    ])("returns the original value for %p with currency %p", (value, currency) => {
      expect(toMinorUnits(value, currency)).toBe(value);
    });
  });
});
