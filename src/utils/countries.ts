export interface CountryItem {
  code: string;
  name: string;
  dialCode: string;
  dialDigits: string;
  flag: string;
  minDigits: number;
  maxDigits: number;
  /** Exact local digit length at which OTP auto-sends after 300ms (null if variable length). */
  autoSendDigits: number | null;
}

export const COUNTRIES: CountryItem[] = [
  { code: "IN", name: "India", dialCode: "+91", dialDigits: "91", flag: "🇮🇳", minDigits: 10, maxDigits: 10, autoSendDigits: 10 },
  { code: "US", name: "United States", dialCode: "+1", dialDigits: "1", flag: "🇺🇸", minDigits: 10, maxDigits: 10, autoSendDigits: 10 },
  { code: "CA", name: "Canada", dialCode: "+1", dialDigits: "1", flag: "🇨🇦", minDigits: 10, maxDigits: 10, autoSendDigits: 10 },
  { code: "GB", name: "United Kingdom", dialCode: "+44", dialDigits: "44", flag: "🇬🇧", minDigits: 10, maxDigits: 10, autoSendDigits: 10 },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", dialDigits: "971", flag: "🇦🇪", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "SG", name: "Singapore", dialCode: "+65", dialDigits: "65", flag: "🇸🇬", minDigits: 8, maxDigits: 8, autoSendDigits: 8 },
  { code: "AU", name: "Australia", dialCode: "+61", dialDigits: "61", flag: "🇦🇺", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", dialDigits: "966", flag: "🇸🇦", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "QA", name: "Qatar", dialCode: "+974", dialDigits: "974", flag: "🇶🇦", minDigits: 8, maxDigits: 8, autoSendDigits: 8 },
  { code: "KW", name: "Kuwait", dialCode: "+965", dialDigits: "965", flag: "🇰🇼", minDigits: 8, maxDigits: 8, autoSendDigits: 8 },
  { code: "BH", name: "Bahrain", dialCode: "+973", dialDigits: "973", flag: "🇧🇭", minDigits: 8, maxDigits: 8, autoSendDigits: 8 },
  { code: "OM", name: "Oman", dialCode: "+968", dialDigits: "968", flag: "🇴🇲", minDigits: 8, maxDigits: 8, autoSendDigits: 8 },
  { code: "DE", name: "Germany", dialCode: "+49", dialDigits: "49", flag: "🇩🇪", minDigits: 7, maxDigits: 12, autoSendDigits: null },
  { code: "FR", name: "France", dialCode: "+33", dialDigits: "33", flag: "🇫🇷", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "NL", name: "Netherlands", dialCode: "+31", dialDigits: "31", flag: "🇳🇱", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "IE", name: "Ireland", dialCode: "+353", dialDigits: "353", flag: "🇮🇪", minDigits: 7, maxDigits: 9, autoSendDigits: null },
  { code: "CH", name: "Switzerland", dialCode: "+41", dialDigits: "41", flag: "🇨🇭", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "ES", name: "Spain", dialCode: "+34", dialDigits: "34", flag: "🇪🇸", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "IT", name: "Italy", dialCode: "+39", dialDigits: "39", flag: "🇮🇹", minDigits: 9, maxDigits: 10, autoSendDigits: null },
  { code: "SE", name: "Sweden", dialCode: "+46", dialDigits: "46", flag: "🇸🇪", minDigits: 7, maxDigits: 10, autoSendDigits: null },
  { code: "NO", name: "Norway", dialCode: "+47", dialDigits: "47", flag: "🇳🇴", minDigits: 8, maxDigits: 8, autoSendDigits: 8 },
  { code: "DK", name: "Denmark", dialCode: "+45", dialDigits: "45", flag: "🇩🇰", minDigits: 8, maxDigits: 8, autoSendDigits: 8 },
  { code: "PL", name: "Poland", dialCode: "+48", dialDigits: "48", flag: "🇵🇱", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "JP", name: "Japan", dialCode: "+81", dialDigits: "81", flag: "🇯🇵", minDigits: 9, maxDigits: 10, autoSendDigits: null },
  { code: "KR", name: "South Korea", dialCode: "+82", dialDigits: "82", flag: "🇰🇷", minDigits: 9, maxDigits: 10, autoSendDigits: null },
  { code: "HK", name: "Hong Kong", dialCode: "+852", dialDigits: "852", flag: "🇭🇰", minDigits: 8, maxDigits: 8, autoSendDigits: 8 },
  { code: "TW", name: "Taiwan", dialCode: "+886", dialDigits: "886", flag: "🇹🇼", minDigits: 8, maxDigits: 9, autoSendDigits: null },
  { code: "MY", name: "Malaysia", dialCode: "+60", dialDigits: "60", flag: "🇲🇾", minDigits: 9, maxDigits: 10, autoSendDigits: null },
  { code: "ID", name: "Indonesia", dialCode: "+62", dialDigits: "62", flag: "🇮🇩", minDigits: 9, maxDigits: 12, autoSendDigits: null },
  { code: "PH", name: "Philippines", dialCode: "+63", dialDigits: "63", flag: "🇵🇭", minDigits: 10, maxDigits: 10, autoSendDigits: 10 },
  { code: "TH", name: "Thailand", dialCode: "+66", dialDigits: "66", flag: "🇹🇭", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "VN", name: "Vietnam", dialCode: "+84", dialDigits: "84", flag: "🇻🇳", minDigits: 9, maxDigits: 10, autoSendDigits: null },
  { code: "LK", name: "Sri Lanka", dialCode: "+94", dialDigits: "94", flag: "🇱🇰", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "BD", name: "Bangladesh", dialCode: "+880", dialDigits: "880", flag: "🇧🇩", minDigits: 10, maxDigits: 10, autoSendDigits: 10 },
  { code: "NP", name: "Nepal", dialCode: "+977", dialDigits: "977", flag: "🇳🇵", minDigits: 10, maxDigits: 10, autoSendDigits: 10 },
  { code: "NZ", name: "New Zealand", dialCode: "+64", dialDigits: "64", flag: "🇳🇿", minDigits: 8, maxDigits: 10, autoSendDigits: null },
  { code: "ZA", name: "South Africa", dialCode: "+27", dialDigits: "27", flag: "🇿🇦", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "NG", name: "Nigeria", dialCode: "+234", dialDigits: "234", flag: "🇳🇬", minDigits: 10, maxDigits: 10, autoSendDigits: 10 },
  { code: "KE", name: "Kenya", dialCode: "+254", dialDigits: "254", flag: "🇰🇪", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "EG", name: "Egypt", dialCode: "+20", dialDigits: "20", flag: "🇪🇬", minDigits: 10, maxDigits: 10, autoSendDigits: 10 },
  { code: "IL", name: "Israel", dialCode: "+972", dialDigits: "972", flag: "🇮🇱", minDigits: 9, maxDigits: 9, autoSendDigits: 9 },
  { code: "BR", name: "Brazil", dialCode: "+55", dialDigits: "55", flag: "🇧🇷", minDigits: 10, maxDigits: 11, autoSendDigits: null },
  { code: "MX", name: "Mexico", dialCode: "+52", dialDigits: "52", flag: "🇲🇽", minDigits: 10, maxDigits: 10, autoSendDigits: 10 },
  { code: "AR", name: "Argentina", dialCode: "+54", dialDigits: "54", flag: "🇦🇷", minDigits: 10, maxDigits: 11, autoSendDigits: null },
];

export const DEFAULT_COUNTRY: CountryItem = COUNTRIES[0];

const COUNTRIES_BY_DIAL_DESC = [...COUNTRIES].sort(
  (a, b) => b.dialDigits.length - a.dialDigits.length,
);

export function getCountryByCode(code?: string | null): CountryItem {
  if (!code) return DEFAULT_COUNTRY;
  const upper = code.trim().toUpperCase();
  return COUNTRIES.find((c) => c.code === upper) ?? DEFAULT_COUNTRY;
}

export function getCountryByDialCode(dialCode?: string | null): CountryItem | undefined {
  if (!dialCode) return undefined;
  const cleanDigits = dialCode.replace(/\D/g, "");
  if (!cleanDigits) return undefined;
  return COUNTRIES_BY_DIAL_DESC.find((c) => c.dialDigits === cleanDigits);
}

/**
 * Sanitizes typed or pasted local phone input for a specific country.
 * Strips pasted +dialCode / leading trunk 0 when appropriate and caps to country.maxDigits.
 */
export function sanitizeLocalPhoneInput(raw: string, country: CountryItem = DEFAULT_COUNTRY): string {
  const trimmed = (raw || "").trim();
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  if (
    trimmed.startsWith("+") &&
    digits.startsWith(country.dialDigits) &&
    digits.length > country.dialDigits.length
  ) {
    digits = digits.slice(country.dialDigits.length);
  } else if (
    digits.startsWith(country.dialDigits) &&
    digits.length > country.maxDigits
  ) {
    digits = digits.slice(country.dialDigits.length);
  }

  // Strip local trunk '0' prefix (e.g. 09876543210 or 07700900123 -> local digits)
  if (digits.startsWith("0") && digits.length > country.minDigits) {
    digits = digits.slice(1);
  }

  if (digits.length > country.maxDigits) {
    digits = digits.slice(0, country.maxDigits);
  }

  return digits;
}

export function isValidLocalPhone(digits: string, country: CountryItem = DEFAULT_COUNTRY): boolean {
  const clean = (digits || "").replace(/\D/g, "");
  return clean.length >= country.minDigits && clean.length <= country.maxDigits;
}

/**
 * Normalizes a local number or E.164 string to strict E.164 format (+<dial><local>).
 */
export function toE164Phone(
  rawPhone: string,
  countryOrDialCode: CountryItem | string = DEFAULT_COUNTRY,
): string {
  const trimmed = String(rawPhone || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  const country =
    typeof countryOrDialCode === "string"
      ? getCountryByDialCode(countryOrDialCode) ?? {
          ...DEFAULT_COUNTRY,
          dialCode: countryOrDialCode.startsWith("+")
            ? countryOrDialCode
            : `+${countryOrDialCode.replace(/\D/g, "")}`,
          dialDigits: countryOrDialCode.replace(/\D/g, "") || DEFAULT_COUNTRY.dialDigits,
        }
      : countryOrDialCode;

  let local = digits;
  if (local.startsWith("0") && local.length > country.minDigits) {
    local = local.slice(1);
  }
  if (local.startsWith(country.dialDigits) && local.length > country.maxDigits) {
    local = local.slice(country.dialDigits.length);
  }
  if (!local) return "";

  return `+${country.dialDigits}${local}`;
}

export function parseE164Phone(
  e164OrLocal: string,
  fallbackCountry: CountryItem = DEFAULT_COUNTRY,
): { country: CountryItem; localNumber: string; e164: string } {
  const trimmed = String(e164OrLocal || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return { country: fallbackCountry, localNumber: "", e164: "" };
  }

  if (trimmed.startsWith("+")) {
    const matched = COUNTRIES_BY_DIAL_DESC.find((c) =>
      digits.startsWith(c.dialDigits),
    );
    if (matched) {
      const localNumber = digits.slice(matched.dialDigits.length);
      return {
        country: matched,
        localNumber,
        e164: `+${digits}`,
      };
    }
    return {
      country: fallbackCountry,
      localNumber: digits,
      e164: `+${digits}`,
    };
  }

  const sanitized = sanitizeLocalPhoneInput(trimmed, fallbackCountry);
  return {
    country: fallbackCountry,
    localNumber: sanitized,
    e164: toE164Phone(sanitized, fallbackCountry),
  };
}

export function formatDisplayPhone(
  e164OrLocal: string,
  country: CountryItem = DEFAULT_COUNTRY,
): string {
  const trimmed = String(e164OrLocal || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const parsed = parseE164Phone(trimmed, country);
    if (parsed.localNumber && parsed.country.dialCode) {
      return `${parsed.country.dialCode} ${parsed.localNumber}`;
    }
    return trimmed;
  }
  return `${country.dialCode} ${trimmed.replace(/\D/g, "")}`;
}

