// Run: npm test -- ai
// Indian-script digits to 0-9: used before the figure checks on voice-note and card translations.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { asciiDigits } from "../digits";

describe("asciiDigits", () => {
  it("converts every supported script's 0-9", () => {
    const zeros: [string, number][] = [
      ["Devanagari", 0x0966],
      ["Bengali", 0x09e6],
      ["Gurmukhi", 0x0a66],
      ["Gujarati", 0x0ae6],
      ["Odia", 0x0b66],
      ["Tamil", 0x0be6],
      ["Telugu", 0x0c66],
      ["Kannada", 0x0ce6],
      ["Malayalam", 0x0d66],
      ["Arabic-Indic", 0x0660],
      ["Extended Arabic-Indic", 0x06f0],
    ];
    for (const [script, zero] of zeros) {
      const digits = Array.from({ length: 10 }, (_, i) => String.fromCodePoint(zero + i)).join("");
      assert.equal(asciiDigits(digits), "0123456789", script);
    }
  });

  it("keeps the words and symbols around the figures", () => {
    assert.equal(asciiDigits("লঞ্চে ৩ মাস ফ্রি পান"), "লঞ্চে 3 মাস ফ্রি পান");
    assert.equal(asciiDigits("₹२९९ प्रति माह"), "₹299 प्रति माह");
    assert.equal(asciiDigits("Rs 1,600 / mo"), "Rs 1,600 / mo");
  });

  it("leaves letters next to the digit blocks alone", () => {
    // U+0965 (Devanagari double danda) sits just before ० and U+0970 just after ९.
    assert.equal(asciiDigits("॥॰"), "॥॰");
    assert.equal(asciiDigits(""), "");
  });

  it("handles mixed scripts in one string", () => {
    assert.equal(asciiDigits("৩ + ३ + 3"), "3 + 3 + 3");
  });
});
