// deps

  // locals
  import { getIndicatorGlyphPaint } from "../../types/indicator";

// types & interfaces

  // locals
  import type { Indicator, IndicatorGlyphPaint } from "../../types/indicator";

// consts

  const GLYPH_CLASS = "li-tracker-icon-glyph";
  const CHAR_CLASS = "li-tracker-icon-glyph-char";

// private

  // methods

  function _appendGlyphChar (glyph: HTMLElement, icon: string): HTMLElement {

    const glyphChar = glyph.ownerDocument.createElement("span");

    glyphChar.className = CHAR_CLASS;
    glyphChar.textContent = icon;
    glyph.append(glyphChar);
    return glyphChar;

  }

  function _appendStrike (glyph: HTMLElement): void {

    const strike = glyph.ownerDocument.createElement("span");

    strike.className = `${GLYPH_CLASS}-strike`;
    strike.setAttribute("aria-hidden", "true");
    glyph.append(strike);

  }

  function _paintGlyph (glyph: HTMLElement, paint: IndicatorGlyphPaint): void {

    if (paint.strike) {
      glyph.classList.add(`${GLYPH_CLASS}--strike`);
      _appendStrike(glyph);
    }

    if ("none" !== paint.color) {
      glyph.classList.add(`${GLYPH_CLASS}--color-${paint.color}`);
    }

  }

// module

export function createIndicatorGlyph (doc: Document, indicator: Indicator): HTMLSpanElement {

  const glyph = doc.createElement("span");
  const paint = getIndicatorGlyphPaint(indicator);

  glyph.className = GLYPH_CLASS;
  _appendGlyphChar(glyph, indicator.icon);
  _paintGlyph(glyph, paint);

  return glyph;

}
