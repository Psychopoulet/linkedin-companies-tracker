import { normalizeLinkedinCode } from "../../types/company";

const COMPANY_PATH_PATTERN = /\/company\/([^/?#]+)/i;

export function extractLinkedinCodeFromPathname(pathname: string): string | null {
  const match = pathname.match(COMPANY_PATH_PATTERN);
  if (!match) return null;

  try {
    return normalizeLinkedinCode(decodeURIComponent(match[1]));
  } catch {
    return normalizeLinkedinCode(match[1]);
  }
}

export function extractLinkedinCodeFromHref(href: string): string | null {
  try {
    return extractLinkedinCodeFromPathname(new URL(href, window.location.origin).pathname);
  } catch {
    return extractLinkedinCodeFromPathname(href);
  }
}
