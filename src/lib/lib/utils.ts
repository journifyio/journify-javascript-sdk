export const parseNumberToString = (value: number | string): string => {
  if (typeof value === "number") {
    return value.toString();
  }
  return value;
};

export function normalizePhone(
  phoneNumber: string,
  countryCode: string
): string {
  // handle empty and sha256 values
  if (!phoneNumber || phoneNumber?.length == 64) {
    return phoneNumber;
  }

  // Remove all non-numeric characters
  let cleanedPhone = phoneNumber.replace(/[^0-9]/g, "");

  // Check if the number starts with a leading zero, remove it
  if (cleanedPhone.startsWith("0")) {
    cleanedPhone = cleanedPhone.substring(1); // Remove leading zero
  }

  // Check if the cleaned phone number does not already include the country code
  if (cleanedPhone.length <= 10 || !cleanedPhone.startsWith(countryCode)) {
    cleanedPhone = `${countryCode}${cleanedPhone}`;
  }

  // Return the number in E.164 format
  return cleanedPhone;
}

// Cleans the traits object by keeping only non-empty strings and valid finite numbers
export function cleanTraits(obj: unknown): Record<string, unknown> {
  // Handle null, undefined, or non-object inputs
  if (!obj || typeof obj !== "object") {
    return {};
  }

  const cleanedObj: Record<string, unknown> = {};
  // Use Object.keys to avoid prototype pollution and only iterate over own properties
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    switch (typeof value) {
      case "string":
        // Skip empty or whitespace-only strings
        if (value.trim().length > 0) {
          cleanedObj[key] = value;
        }
        break;
      case "number":
        // Keep only valid finite numbers
        if (!isNaN(value) && isFinite(value)) {
          cleanedObj[key] = value;
        }
        break;
      case "boolean":
      case "object":
        if (value !== null) {
          cleanedObj[key] = value;
        }
        break;
      default:
        // Ignore undefined, functions, symbols, and other non-JSON-compatible types
        break;
    }
  }

  return cleanedObj;
}
