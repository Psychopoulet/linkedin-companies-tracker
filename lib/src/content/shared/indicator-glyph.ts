// deps

  // locals
  import { getIndicatorGlyphPaint } from "../../types/indicator";

// types & interfaces

  // locals
  import type { Indicator } from "../../types/indicator";

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

// module

export function createIndicatorGlyph (doc: Document, indicator: Indicator): HTMLSpanElement {

  const glyph = doc.createElement("span");
  const paint = getIndicatorGlyphPaint(indicator);

  glyph.className = GLYPH_CLASS;
  _appendGlyphChar(glyph, indicator.icon);

  if ("strike" === paint.mode) {
    glyph.classList.add(`${GLYPH_CLASS}--strike`);
    _appendStrike(glyph);
  }

  return glyph;

}
