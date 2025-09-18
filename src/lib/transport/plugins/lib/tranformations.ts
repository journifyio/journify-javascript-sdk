/* eslint-disable  @typescript-eslint/no-explicit-any */

export type Transformation = (value: any) => any;

export function applyTransformations(
  value: any,
  transformations: Transformation[]
): any {
  let v = value;
  for (const transformation of transformations) {
    v = transformation(v);
  }

  return v;
}

export function toDigitsOnlyPhone(phone: string): string {
  if (!phone) {
    return phone;
  }

  return phone.replace(/\D/g, "");
}

export function trim(str: string): string {
  if (!str) {
    return str;
  }

  if (typeof str !== "string") {
    return str;
  }

  return str.trim() || null;
}

export function toLowerCase(str: string): string {
  if (!str) {
    return str;
  }

  if (typeof str !== "string") {
    return str;
  }

  return str.toLowerCase() || null;
}

export function oneLetterGender(str: string): string {
  if (!str) {
    return str;
  }

  return str.trim().charAt(0);
}

export function facebookBirthday(birthDate: string): string {
  if (!birthDate) {
    return birthDate;
  }

  const date = new Date(birthDate);
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2); // Months are zero-based
  const day = ("0" + date.getDate()).slice(-2);

  return year.toString() + month.toString() + day.toString();
}

export function toInt(str: string): number | null {
  const number = parseInt(str, 10);
  return isNaN(number) ? null : number;
}

/*
 * Converts a phone number to E.164 format.
 * Assumes the input is a valid phone number with country code.
 * If the phone number is less than 10 digits, it returns null.
 */
export function toE164(phone: string): string | null {
  if (!phone) {
    return phone;
  }

  const digitsOnly = toDigitsOnlyPhone(phone);
  if (digitsOnly.length < 10) {
    return null; // Not a valid E.164 format
  }
  // Assuming the phone number is in the format +<country_code><number>
  return `+${digitsOnly}`;
}
