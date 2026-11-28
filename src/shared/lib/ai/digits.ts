/**
 * Indian-script (and Arabic) digits to 0-9, e.g. "৩ মাস" -> "3 মাস", "₹५००" -> "₹500". A model translating into Hindi
 * or Bengali may write a figure in that script's digits: the same number, so it is normalised rather than rejected.
 * Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam, Arabic-Indic, Extended Arabic-Indic.
 */
const DIGIT_ZEROS = [0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0660, 0x06f0];

export function asciiDigits(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
    out += zero === undefined ? ch : String(cp - zero);
  }
  return out;
}
