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

  function _paintTextGlyph (glyph: HTMLElement, glyphChar: HTMLElement, color: string): void {

    glyph.classList.add(`${GLYPH_CLASS}--text`);
    glyph.style.setProperty("--li-tracker-glyph-color", color);
    glyph.style.color = color;
    glyph.style.setProperty("-webkit-text-fill-color", color);
    glyph.style.setProperty("font-variant-emoji", "text");
    glyphChar.style.color = color;
    glyphChar.style.setProperty("-webkit-text-fill-color", color);
    glyphChar.style.setProperty("font-variant-emoji", "text");

  }

// module

export function createIndicatorGlyph (doc: Document, indicator: Indicator): HTMLSpanElement {

  const glyph = doc.createElement("span");
  const paint = getIndicatorGlyphPaint(indicator);

  glyph.className = GLYPH_CLASS;

  const glyphChar = _appendGlyphChar(glyph, indicator.icon);

  if ("tint" === paint.mode) {
    glyph.classList.add(`${GLYPH_CLASS}--tint`);
  }
  else if ("text" === paint.mode) {
    _paintTextGlyph(glyph, glyphChar, paint.color);
  }

  return glyph;

}
