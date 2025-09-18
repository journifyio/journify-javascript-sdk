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

export function removeEmptyStrings(obj: object): object {
  const cleanedObj = {};
  for (const key in obj) {
    if (typeof obj[key] === "string" && obj[key].trim().length > 0) {
      cleanedObj[key] = obj[key];
    }
  }

  return cleanedObj;
}
