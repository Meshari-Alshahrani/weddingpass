/**
 * Utility for normalizing and standardizing Saudi and international phone numbers.
 * Converts Eastern Arabic numerals (٠-٩) to Latin (0-9), strips formatting characters,
 * and standardizes to 9665XXXXXXXX format for accurate duplicate checking.
 */

const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export function normalizeSaudiPhone(rawPhone: string): string {
  if (!rawPhone) return '';

  // 1. Convert Arabic-Indic numerals to Latin digits
  let clean = rawPhone.replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS[digit] || digit);

  // 2. Remove all non-numeric characters (spaces, dashes, parentheses, plus signs)
  clean = clean.replace(/[^0-9]/g, '');

  // 3. Normalize Saudi numbers to 9665XXXXXXXX
  if (clean.startsWith('00966')) {
    clean = clean.substring(2);
  } else if (clean.startsWith('05') && clean.length === 10) {
    clean = '966' + clean.substring(1);
  } else if (clean.startsWith('5') && clean.length === 9) {
    clean = '966' + clean;
  }

  return clean;
}

export function formatPhoneDisplay(normalizedPhone: string): string {
  if (!normalizedPhone) return '';
  if (normalizedPhone.startsWith('966') && normalizedPhone.length === 12) {
    return `0${normalizedPhone.substring(3, 5)} ${normalizedPhone.substring(5, 8)} ${normalizedPhone.substring(8)}`;
  }
  return normalizedPhone;
}
