// deps

  // locals
  import { extractLinkedinCodeFromPathname } from "./linkedin-url";

// consts

  const COMPANY_TITLE_SELECTORS = [
    "h1.org-top-card-summary__title",
    "h1.org-top-card-summary-info-list__info-item",
    "h1[class*='org-top-card']",
    "main h1"
  ];

// module

export function getLinkedinCodeFromUrl (url = window.location.href): string | null {

  try {
    return extractLinkedinCodeFromPathname(new URL(url).pathname);
  }
  catch {
    return null;
  }

}

export function findCompanyTitleElement (): HTMLElement | null {

  for (const selector of COMPANY_TITLE_SELECTORS) {

    const element = document.querySelector<HTMLElement>(selector);

    if (null !== element && "" !== element.textContent.trim()) {
      return element;
    }

  }

  return null;

}

export function getCompanyNameFromElement (element: HTMLElement): string {

  const clone = element.cloneNode(true) as HTMLElement;

  clone.querySelectorAll(".li-tracker-add-btn").forEach((btn) => {
    btn.remove();
  });

  return clone.textContent.trim();

}

export function isCompanyPage (): boolean {
  return null !== getLinkedinCodeFromUrl();
}
