import {
  applyTransformations,
  facebookBirthday,
  oneLetterGender,
  toDigitsOnlyPhone,
  toLowerCase,
  trim,
} from "../tranformations";
import { randomUUID } from "node:crypto";

describe("Transformations", () => {
  describe("applyTransformations", () => {
    it("should apply all transformations to value", () => {
      const firstTrans = jest.fn().mockReturnValue("test");
      const secondTrans = jest.fn().mockReturnValue("test2");
      const value = randomUUID();
      const transformations = [firstTrans, secondTrans];

      const result = applyTransformations(value, transformations);

      expect(result).toBe("test2");
      expect(firstTrans).toHaveBeenCalledTimes(1);
      expect(secondTrans).toHaveBeenCalledTimes(1);

      expect(firstTrans).toHaveBeenCalledWith(value);
      expect(secondTrans).toHaveBeenCalledWith("test");
    });

    it("should return the same value if there is no transformation to apply", () => {
      const value = randomUUID();
      const result = applyTransformations(value, []);
      expect(result).toEqual(value);
    });
  });

  describe("toDigitsOnlyPhone", () => {
    it("should return a phone with only digits", () => {
      const phone = "+212 6 96 10 06 19";
      const result = toDigitsOnlyPhone(phone);
      expect(result).toBe("212696100619");
    });

    it("should return an empty string if the input is an empty string", () => {
      const result = toDigitsOnlyPhone("");
      expect(result).toBe("");
    });

    it("should return null if the input is null", () => {
      const result = toDigitsOnlyPhone(null);
      expect(result).toBeNull();
    });
  });

  describe("trim", () => {
    it("should trim a string", () => {
      const str = "  test  ";
      const result = trim(str);
      expect(result).toBe("test");
    });

    it("should return an empty string if the input is empty", () => {
      const result = trim("");
      expect(result).toBe("");
    });

    it("should return null if the input is null", () => {
      const result = trim(null);
      expect(result).toBeNull();
    });
  });

  describe("toLowerCase", () => {
    it("should convert a string to lower case", () => {
      const str = "TESSt";
      const result = toLowerCase(str);
      expect(result).toBe("tesst");
    });

    it("should return an empty string if the input is empty", () => {
      const result = toLowerCase("");
      expect(result).toBe("");
    });

    it("should return null if the input is null", () => {
      const result = toLowerCase(null);
      expect(result).toBeNull();
    });
  });

  describe("oneLetterGender", () => {
    it("should convert genders to one letter genders", () => {
      const gender1 = "female";
      const result1 = oneLetterGender(gender1);
      expect(result1).toBe("f");

      const gender2 = "Male";
      const result2 = oneLetterGender(gender2);
      expect(result2).toBe("M");
    });

    it("should return an empty string if the input is empty", () => {
      const result = oneLetterGender("");
      expect(result).toBe("");
    });

    it("should return null if the input is null", () => {
      const result = oneLetterGender(null);
      expect(result).toBeNull();
    });
  });

  describe("facebookBirthday", () => {
    it("should format date according to Facebook format (YYYYMMDD)", () => {
      const date = "1999-03-05T16:02:39.116Z";
      const result = facebookBirthday(date);
      expect(result).toBe("19990305");
    });

    it("should return an empty string if the input is empty", () => {
      const result = facebookBirthday("");
      expect(result).toBe("");
    });

    it("should return null if the input is null", () => {
      const result = facebookBirthday(null);
      expect(result).toBeNull();
    });
  });
});
