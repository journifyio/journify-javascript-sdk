import {isValidWriteKey} from "../loader";

describe("write key validation", () => {
  const suffix = "a1B2c3D4e5F6g7H8i9J0k1L2m3N";

  it.each([
    `wk_${suffix}`,
    `wk_test_${suffix}`,
  ])("accepts a valid write key: %s", (writeKey) => {
    expect(isValidWriteKey(writeKey)).toBe(true);
  });

  it.each([
    null,
    undefined,
    "",
    suffix,
    `wk_${suffix.slice(1)}`,
    `wk_${suffix}4`,
    `wk_${suffix.slice(0, -1)}_`,
    `wk_test_${suffix.slice(1)}`,
    `wk_test_${suffix}4`,
    `wk_test_${suffix.slice(0, -1)}-`,
  ])("rejects an invalid write key: %s", (writeKey) => {
    expect(isValidWriteKey(writeKey)).toBe(false);
  });
});
