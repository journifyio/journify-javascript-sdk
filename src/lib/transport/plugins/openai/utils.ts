const ZERO_DECIMAL_CURRENCIES = new Set<string>([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);
const THREE_DECIMAL_CURRENCIES = new Set<string>([
  "BHD",
  "JOD",
  "KWD",
  "LYD",
  "OMR",
  "TND",
]);
const FOUR_DECIMAL_CURRENCIES = new Set<string>(["CLF"]);

export function toMinorUnits(value: unknown, currency: unknown): unknown {
  if (value == null) {
    return value;
  }

  const precision = getCurrencyPrecision(currency);
  if (precision == null) {
    return value;
  }

  const amount = parseDecimal(value);
  if (!amount) {
    return value;
  }

  const rounded = roundDecimalToScale(amount, precision);
  if (
    rounded > BigInt(Number.MAX_SAFE_INTEGER) ||
    rounded < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return value;
  }

  return Number(rounded);
}

function getCurrencyPrecision(currency: unknown): number | null {
  if (typeof currency !== "string" || currency.trim() === "") {
    return null;
  }

  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code) || code === "XXX") {
    return null;
  }

  // These ISO 4217 minor-unit exceptions change rarely, so keep them local
  // instead of adding a runtime dependency to event tracking.
  if (FOUR_DECIMAL_CURRENCIES.has(code)) {
    return 4;
  }
  if (THREE_DECIMAL_CURRENCIES.has(code)) {
    return 3;
  }
  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return 0;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    return null;
  }
}

function parseDecimal(
  value: unknown
): { negative: boolean; intPart: string; fracPart: string } | null {
  const raw = typeof value === "number" ? value.toString() : String(value).trim();
  const match = raw.match(/^([+-])?(?:(\d+)(?:\.(\d*))?|\.(\d+))$/);
  if (!match) {
    return null;
  }

  return {
    negative: match[1] === "-",
    intPart: match[2] || "0",
    fracPart: match[3] || match[4] || "",
  };
}

function roundDecimalToScale(
  amount: { negative: boolean; intPart: string; fracPart: string },
  scale: number
): bigint {
  const paddedFraction = amount.fracPart.padEnd(scale, "0");
  const keptFraction = paddedFraction.slice(0, scale);
  const remainder = amount.fracPart.slice(scale);
  const shiftedValue = BigInt(`${amount.intPart}${keptFraction}` || "0");
  const rounded = shouldRoundUp(shiftedValue, remainder)
    ? shiftedValue + BigInt(1)
    : shiftedValue;

  return amount.negative ? -rounded : rounded;
}

function shouldRoundUp(shiftedValue: bigint, remainder: string): boolean {
  if (!remainder || /^0*$/.test(remainder)) {
    return false;
  }

  const firstDigit = Number(remainder[0]);
  if (firstDigit > 5) {
    return true;
  }
  if (firstDigit < 5) {
    return false;
  }

  const afterHalf = remainder.slice(1);
  if (/[^0]/.test(afterHalf)) {
    return true;
  }

  return shiftedValue % BigInt(2) !== BigInt(0);
}
