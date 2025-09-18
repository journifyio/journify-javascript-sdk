/* eslint-disable  @typescript-eslint/no-explicit-any */
export async function hashPII(
  obj: Record<string, any> = {}
): Promise<Record<string, any>> {
  const newObj = {};
  for (const key in obj) {
    let value = obj[key];
    if (value && PII_KEYS.has(key)) {
      value = (value + "").toLowerCase().trim();
      newObj[key] = await sha256Hash(value);
    } else {
      newObj[key] = value;
    }
  }

  return newObj;
}

async function sha256Hash(input: string): Promise<string> {
  if (!input || isSHA256Hash(input)) {
    return input;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

function isSHA256Hash(input: string): boolean {
  const sha256Regex = /^[a-f0-9]{64}$/i;
  return sha256Regex.test(input);
}

const PII_KEYS = new Set([
  "email",
  "phone",
  "name",
  "firstname",
  "lastname",
  "address",
  "city",
  "state",
  "city_code",
  "state_code",
  "country",
  "country_code",
  "gender",
]);
