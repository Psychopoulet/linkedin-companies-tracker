import type { Company, CompanyRegistry } from "../../types/company";
import { stripLeadingIndicatorIcon } from "../../types/indicator";
import { extractLinkedinCodeFromHref } from "./linkedin-url";
import { queryAllDeep, queryDeep } from "./dom-query";

export { extractLinkedinCodeFromHref };

function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function findCompanyByName(
  registry: CompanyRegistry,
  name: string
): Company | undefined {
  const normalized = normalizeCompanyName(stripLeadingIndicatorIcon(name));
  if (!normalized) return undefined;

  return Object.values(registry).find(
    (company) => normalizeCompanyName(company.name) === normalized
  );
}

const COMPANY_NAME_TEXT_SELECTORS = [
  "h4.base-search-card__subtitle",
  ".base-search-card__subtitle",
  ".job-card-container__primary-description",
  ".job-card-container__company-name",
  ".artdeco-entity-lockup__subtitle",
  ".job-details-jobs-unified-top-card__company-name",
  ".jobs-unified-top-card__company-name",
  'a.hidden-nested-link[href*="/company/"]',
  '[class*="company-name"]',
  '[class*="primary-description"]',
  '[class*="subtitle"]',
];

const JOB_CARD_SELECTORS = [
  "li.jobs-search-results__list-item",
  "li.scaffold-layout__list-item",
  "ul.jobs-search__results-list > li",
  "div.job-card-container",
  "[data-job-id]",
  ".base-card",
  ".base-search-card",
  'div[role="listitem"]',
  'li[class*="jobs-search-results"]',
  'div[class*="job-card-container"]',
];

const JOB_CARD_ANCESTOR_SELECTORS = [
  'div[role="listitem"]',
  "li",
  ".base-card",
  ".base-search-card",
  ".job-card-container",
  '[class*="job-card"]',
  '[class*="search-card"]',
];

export function isJobsSearchResultsPage(): boolean {
  return /^\/jobs\/search-results(?:\/|$)/i.test(window.location.pathname);
}

export function isJobsTrackerPage(): boolean {
  return /^\/jobs-tracker(?:\/|$)/i.test(window.location.pathname);
}

function collapseText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function isLikelyLocationOrMeta(text: string): boolean {
  const value = collapseText(text);
  if (!value) return true;
  if (/^(remote|hybrid|on-site|télétravail|sur site)/i.test(value)) return true;
  if (/\((?:sur site|hybrid|remote|télétravail)\)/i.test(value)) return true;
  if (/^(be an early applicant|actively hiring|candidature simplifiée)/i.test(value)) return true;
  if (/\b\d+\s+(hour|day|week|month|jour|semaine|mois|heure)s?\s+ago\b/i.test(value)) return true;
  if (/·/.test(value)) return true;
  if (/^[A-Za-zÀ-ÿ0-9\s.'-]+,\s*[A-Za-zÀ-ÿ0-9\s.'-]+(?:,\s*[A-Za-zÀ-ÿ0-9\s.'-]+)?$/.test(value)) {
    return true;
  }
  return false;
}

function isSameOrNested(a: Node, b: Node): boolean {
  return a === b || a.contains(b) || b.contains(a);
}

function findCompanyNameElementFromSelectors(container: ParentNode): HTMLElement | null {
  const link = findCompanyLinkInContainer(container);
  if (link?.textContent?.trim()) {
    return link;
  }

  for (const selector of COMPANY_NAME_TEXT_SELECTORS) {
    const element = container.querySelector<HTMLElement>(selector);
    if (!element?.textContent?.trim()) continue;

    const nestedLink = element.querySelector<HTMLAnchorElement>("a");
    if (nestedLink?.textContent?.trim()) {
      return nestedLink;
    }
    return element;
  }

  const h4 = container.querySelector("h4");
  if (h4?.textContent?.trim()) {
    return (h4.querySelector("a") ?? h4) as HTMLElement;
  }

  return null;
}

function findNextLineAfterTitle(card: HTMLElement, title: HTMLElement): HTMLElement | null {
  const blocks = Array.from(
    card.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, p, a, span, div")
  );

  let passedTitle = false;
  for (const block of blocks) {
    if (!passedTitle) {
      if (isSameOrNested(block, title)) {
        passedTitle = true;
      }
      continue;
    }

    if (title.contains(block)) continue;

    const text = collapseText(block.textContent ?? "");
    if (!text || text.length > 100) continue;
    if (isLikelyLocationOrMeta(text)) break;

    const companyLink = block.querySelector<HTMLAnchorElement>('a[href*="/company/"]');
    if (companyLink?.textContent?.trim()) {
      return companyLink;
    }

    if (block.matches("h4, h5, p, span, a")) {
      return (block.querySelector("a") ?? block) as HTMLElement;
    }

    if (block.children.length <= 1) {
      return block;
    }
  }

  return null;
}

function isSduiMetaParagraph(text: string): boolean {
  const value = collapseText(text);
  if (!value) return true;
  if (/consulté|premiers candidats|meilleurs candidats|candidature simplifiée|publication il y a|vous seriez parmi|offre d'emploi vérifiée|·/i.test(value)) {
    return true;
  }
  return false;
}

function isCompanyNameText(text: string): boolean {
  const value = collapseText(text);
  if (!value || value.length > 80) return false;
  if (isLikelyLocationOrMeta(value)) return false;
  if (isSduiMetaParagraph(value)) return false;
  if (/engineer|developer|manager|fullstack|architect|consultant/i.test(value)) return false;
  return true;
}

function isSduiJobCard(card: HTMLElement): boolean {
  const key = card.getAttribute("componentkey") ?? "";
  return key.startsWith("job-card-component-ref-");
}

function isInsideListJobCard(element: HTMLElement): boolean {
  return element.closest('[componentkey^="job-card-component-ref-"]') !== null;
}

/** Company line in SDUI job cards: div > p with short name (e.g. "Sander"). */
function findCompanyNameInSduiCard(
  card: HTMLElement,
  options: { excludeListCards?: boolean } = {}
): HTMLElement | null {
  const candidates: HTMLElement[] = [];

  for (const div of Array.from(card.querySelectorAll("div"))) {
    if (options.excludeListCards && isInsideListJobCard(div)) continue;

    const directParagraphs = Array.from(div.children).filter((child) => child.tagName === "P");
    if (directParagraphs.length !== 1) continue;

    const paragraph = directParagraphs[0] as HTMLElement;
    if (options.excludeListCards && isInsideListJobCard(paragraph)) continue;
    if (isCompanyNameText(paragraph.textContent ?? "")) {
      candidates.push(paragraph);
    }
  }

  if (candidates.length === 0) {
    for (const paragraph of Array.from(card.querySelectorAll("p"))) {
      if (options.excludeListCards && isInsideListJobCard(paragraph)) continue;
      if (isCompanyNameText(paragraph.textContent ?? "")) {
        candidates.push(paragraph);
      }
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  for (const paragraph of candidates) {
    let sibling = paragraph.parentElement?.nextElementSibling;
    while (sibling) {
      if (sibling instanceof HTMLElement) {
        const text = collapseText(sibling.textContent ?? "");
        if (text && isLikelyLocationOrMeta(text)) {
          return paragraph;
        }
      }
      sibling = sibling.nextElementSibling;
    }
  }

  return candidates[0];
}

export function findCompanyInSduiCard(
  card: HTMLElement,
  registry: CompanyRegistry
): { element: HTMLElement; company: Company } | null {
  const nameElement = findCompanyNameInSduiCard(card);
  if (!nameElement) return null;

  const company = findCompanyByName(registry, nameElement.textContent?.trim() ?? "");
  if (!company) return null;

  return { element: nameElement, company };
}

/** Company line in left list cards (between title and location). */
export function findCompanyNameElementInListCard(card: HTMLElement): HTMLElement | null {
  if (isSduiJobCard(card) || card.querySelector('[componentkey^="job-card-component-ref-"]')) {
    const sduiName = findCompanyNameInSduiCard(card);
    if (sduiName) return sduiName;
  }

  const title = findJobTitleInContainer(card);
  const fromSelectors = findCompanyNameElementFromSelectors(card);

  if (fromSelectors && title && !isSameOrNested(fromSelectors, title)) {
    const text = collapseText(fromSelectors.textContent ?? "");
    if (text && !isLikelyLocationOrMeta(text)) {
      return fromSelectors;
    }
  }

  if (title) {
    const titleBlock = (title.closest("h3, h2, h4, a") ?? title) as HTMLElement;
    const rowContainer = titleBlock.parentElement;

    if (rowContainer) {
      const siblings = Array.from(rowContainer.children);
      const titleIndex = siblings.findIndex(
        (node) => node.contains(titleBlock) || node === titleBlock
      );

      if (titleIndex >= 0) {
        for (let index = titleIndex + 1; index < siblings.length; index += 1) {
          const sibling = siblings[index];
          if (!(sibling instanceof HTMLElement)) continue;

          const text = collapseText(sibling.textContent ?? "");
          if (!text) continue;
          if (isLikelyLocationOrMeta(text)) break;

          const companyLink = sibling.querySelector<HTMLAnchorElement>('a[href*="/company/"]');
          if (companyLink?.textContent?.trim()) {
            return companyLink;
          }

          return (sibling.querySelector("a") ?? sibling) as HTMLElement;
        }
      }
    }

    const h3 = card.querySelector("h3");
    const h4 = h3?.nextElementSibling;
    if (h4 instanceof HTMLElement) {
      const text = collapseText(h4.textContent ?? "");
      if (text && !isLikelyLocationOrMeta(text)) {
        return (h4.querySelector("a") ?? h4) as HTMLElement;
      }
    }

    const structural = findNextLineAfterTitle(card, title);
    if (structural) return structural;
  }

  return fromSelectors;
}

function findCompanyNameText(container: ParentNode): string | null {
  return findCompanyNameElement(container)?.textContent?.trim() || null;
}

function findCompanyLinkInContainer(container: ParentNode): HTMLAnchorElement | null {
  const companyNameSelectors = [
    "a.hidden-nested-link[href*='/company/']",
    ".job-card-container__company-name a",
    ".job-card-container__primary-description a",
    ".artdeco-entity-lockup__subtitle a",
    ".base-search-card__subtitle a",
    "h4.base-search-card__subtitle a",
    '[class*="company-name"] a',
    ".job-details-jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name a",
    'a[href*="/company/"]',
  ];

  for (const selector of companyNameSelectors) {
    const link = container.querySelector<HTMLAnchorElement>(selector);
    if (link?.textContent?.trim()) {
      return link;
    }
  }

  return null;
}

/** Element that displays the company name (link preferred). */
export function findCompanyNameElement(container: ParentNode): HTMLElement | null {
  return findCompanyNameElementFromSelectors(container);
}

/** Resolve a tracked company from a job card / detail container. */
export function resolveCompanyFromContainer(
  container: ParentNode,
  registry: CompanyRegistry
): Company | undefined {
  const link = findCompanyLinkInContainer(container);
  if (link) {
    const code = extractLinkedinCodeFromHref(link.href);
    if (code && registry[code]) {
      return registry[code];
    }

    const linkName = link.textContent?.trim();
    if (linkName) {
      const byLinkName = findCompanyByName(registry, linkName);
      if (byLinkName) return byLinkName;
    }
  }

  if (container instanceof HTMLElement) {
    const sduiName = findCompanyNameInSduiCard(container);
    if (sduiName) {
      const bySduiName = findCompanyByName(registry, sduiName.textContent?.trim() ?? "");
      if (bySduiName) return bySduiName;
    }

    const listName = findCompanyNameElementInListCard(container);
    if (listName) {
      const byListName = findCompanyByName(registry, listName.textContent?.trim() ?? "");
      if (byListName) return byListName;
    }
  }

  const nameText = findCompanyNameText(container);
  if (nameText) {
    return findCompanyByName(registry, nameText);
  }

  return undefined;
}

const JOB_TITLE_SELECTORS = [
  "a.job-card-list__title--link",
  ".job-card-list__title--link",
  "a.job-card-container__link",
  ".job-card-list__title",
  ".job-card-container__link",
  "a[data-control-name='job_card_title']",
  "h3.base-search-card__title a",
  "h3.base-search-card__title",
  "h3.job-card-list__title",
  ".artdeco-entity-lockup__title a",
  ".artdeco-entity-lockup__title",
  '[class*="job-card"] h3 a',
  '[class*="job-card"] a[class*="title"]',
  'a[href*="/jobs/view/"]',
];

function findJobTitleInContainer(container: ParentNode): HTMLElement | null {
  for (const selector of JOB_TITLE_SELECTORS) {
    const element = container.querySelector<HTMLElement>(selector);
    if (element?.textContent?.trim()) {
      return element;
    }
  }
  return null;
}

function isJobCardCandidate(card: HTMLElement): boolean {
  return Boolean(
    findJobTitleInContainer(card) ||
      findCompanyNameElement(card) ||
      findCompanyLinkInContainer(card) ||
      card.querySelector('a[href*="/jobs/view/"]')
  );
}

function findJobCardsFromViewLinks(root: ParentNode): HTMLElement[] {
  const cards = new Set<HTMLElement>();

  for (const link of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href*="/jobs/view/"]'))) {
    if (!link.textContent?.trim()) continue;

    const card = link.closest(JOB_CARD_ANCESTOR_SELECTORS.join(", "));
    if (card instanceof HTMLElement && isJobCardCandidate(card)) {
      cards.add(card);
    }
  }

  return [...cards];
}

function collectJobCardsInRoot(root: ParentNode): HTMLElement[] {
  const cards = new Set<HTMLElement>();

  if (isJobsSearchResultsPage()) {
    root.querySelectorAll<HTMLElement>('div[role="listitem"]').forEach((item) => {
      if (item.querySelector('a[href*="/jobs/view/"]')) {
        cards.add(item);
      }
    });
  }

  for (const selector of JOB_CARD_SELECTORS) {
    root.querySelectorAll<HTMLElement>(selector).forEach((card) => {
      if (isJobCardCandidate(card)) {
        cards.add(card);
      }
    });
  }

  findJobCardsFromViewLinks(root).forEach((card) => cards.add(card));

  return [...cards];
}

const JOB_DETAIL_PANEL_SELECTORS = [
  ".jobs-search__job-details--container",
  ".jobs-search__job-details",
  ".job-details-jobs-unified-top-card",
  ".jobs-unified-top-card",
  '[class*="jobs-details"]',
];

function panelContainsSduiListCards(panel: HTMLElement): boolean {
  return panel.querySelector('[componentkey^="job-card-component-ref-"]') !== null;
}

function findJobDetailPanel(): HTMLElement | null {
  for (const selector of JOB_DETAIL_PANEL_SELECTORS) {
    for (const panel of queryAllDeep<HTMLElement>(document, selector)) {
      if (isJobsSearchResultsPage() && panelContainsSduiListCards(panel)) {
        continue;
      }
      return panel;
    }
  }
  return null;
}

function findCardFromJobLink(link: HTMLAnchorElement): HTMLElement | null {
  const fromClosest = link.closest(JOB_CARD_ANCESTOR_SELECTORS.join(", "));
  if (fromClosest instanceof HTMLElement) {
    return fromClosest;
  }

  let current: HTMLElement | null = link.parentElement;
  while (current) {
    const jobLinks = current.querySelectorAll('a[href*="/jobs/view/"]');
    if (jobLinks.length === 1 && jobLinks[0] === link) {
      return current;
    }
    current = current.parentElement;
  }

  return link.parentElement;
}

function isInsideJobDetailPanel(element: HTMLElement, detailPanel: HTMLElement | null): boolean {
  if (!detailPanel?.contains(element)) return false;
  if (!isJobsSearchResultsPage()) return true;

  const card = element.closest('[componentkey^="job-card-component-ref-"]');
  return !card || detailPanel.contains(card);
}

/** Cards in the left list, excluding the detail panel on the right. */
function findListJobCardsExcludingDetail(): HTMLElement[] {
  const detailPanel = findJobDetailPanel();
  const cards = new Set<HTMLElement>();

  const sduiSelectors = [
    '[role="button"][componentkey^="job-card-component-ref-"]',
    '[componentkey^="job-card-component-ref-"]',
  ];

  for (const selector of sduiSelectors) {
    for (const item of queryAllDeep<HTMLElement>(document, selector)) {
      if (isInsideJobDetailPanel(item, detailPanel)) continue;
      cards.add(item);
    }
  }

  for (const wrapper of queryAllDeep<HTMLElement>(document, '[data-display-contents="true"]')) {
    const card = wrapper.querySelector<HTMLElement>('[componentkey^="job-card-component-ref-"]');
    if (!card || isInsideJobDetailPanel(card, detailPanel)) continue;
    cards.add(card.closest<HTMLElement>('[role="button"]') ?? card);
  }

  const listItemSelectors = [
    'div[role="listitem"]',
    "li.scaffold-layout__list-item",
    "li.jobs-search-results__list-item",
    ".job-card-container",
    ".base-card",
    ".base-search-card",
  ];

  for (const selector of listItemSelectors) {
    for (const item of queryAllDeep<HTMLElement>(document, selector)) {
      if (isInsideJobDetailPanel(item, detailPanel)) continue;
      cards.add(item);
    }
  }

  for (const link of queryAllDeep<HTMLAnchorElement>(document, 'a[href*="/jobs/view/"]')) {
    if (isInsideJobDetailPanel(link, detailPanel)) continue;

    const card = findCardFromJobLink(link);
    if (card && !isInsideJobDetailPanel(card, detailPanel)) {
      cards.add(card);
    }
  }

  return keepInnermostCards([...cards]);
}

function parseEntrepriseAriaLabel(label: string | null): string | null {
  if (!label) return null;
  const match = label.match(/entreprise,?\s*(.+?)\.?$/i);
  return match ? collapseText(match[1]) : null;
}

function isDetailJobTitleText(text: string): boolean {
  return /engineer|developer|manager|fullstack|architect|consultant|designer|analyst|lead|développeur|ingénieur/i.test(
    collapseText(text)
  );
}

function findSearchResultsDetailJobViewLink(): HTMLAnchorElement | null {
  for (const link of queryAllDeep<HTMLAnchorElement>(document, 'a[href*="/jobs/view/"]')) {
    if (isInsideListJobCard(link)) continue;

    const text = collapseText(link.textContent ?? "");
    if (!text || isSduiMetaParagraph(text)) continue;
    if (isDetailJobTitleText(text)) {
      return link;
    }
  }
  return null;
}

function findBestDetailCompanyLink(
  links: HTMLAnchorElement[],
  registry: CompanyRegistry
): { element: HTMLElement; company: Company } | null {
  const filtered = links.filter(
    (link) =>
      !isInsideListJobCard(link) &&
      !/\/insights\/|\/posts\//i.test(link.href)
  );

  const ranked = filtered.sort(
    (a, b) => collapseText(a.textContent ?? "").length - collapseText(b.textContent ?? "").length
  );

  for (const link of ranked) {
    const name = collapseText(link.textContent ?? "");
    if (!name || name.length > 80) continue;
    if (isLikelyLocationOrMeta(name) || isSduiMetaParagraph(name)) continue;
    if (isDetailJobTitleText(name)) continue;

    const company = findCompanyByName(registry, name);
    if (company) {
      return { element: link, company };
    }

    const code = extractLinkedinCodeFromHref(link.href);
    if (code && registry[code]) {
      return { element: link, company: registry[code] };
    }
  }

  return null;
}

export function findCompanyInSearchResultsDetail(
  registry: CompanyRegistry
): { element: HTMLElement; company: Company } | null {
  const entrepriseLinks = queryAllDeep<HTMLAnchorElement>(
    document,
    'a[href*="/company/"][aria-label*="Entreprise"], a[href*="/company/"][componentkey^="auto-binding"]'
  );

  for (const link of entrepriseLinks) {
    if (isInsideListJobCard(link)) continue;

    const innerLink = link.querySelector<HTMLAnchorElement>('a[href*="/company/"]') ?? link;
    const name =
      collapseText(innerLink.textContent ?? "") ||
      parseEntrepriseAriaLabel(link.getAttribute("aria-label")) ||
      "";

    const company = findCompanyByName(registry, name);
    if (company) {
      return { element: innerLink, company };
    }

    const code = extractLinkedinCodeFromHref(innerLink.href);
    if (code && registry[code]) {
      return { element: innerLink, company: registry[code] };
    }
  }

  const detailJobLink = findSearchResultsDetailJobViewLink();
  const companyLinks = queryAllDeep<HTMLAnchorElement>(document, 'a[href*="/company/"]').filter(
    (link) => !isInsideListJobCard(link)
  );

  if (detailJobLink) {
    const nearDetail = companyLinks.filter(
      (link) =>
        (link.compareDocumentPosition(detailJobLink) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    );

    const nearMatch = findBestDetailCompanyLink(nearDetail, registry);
    if (nearMatch) return nearMatch;
  }

  return findBestDetailCompanyLink(companyLinks, registry);
}

function findSearchResultsDetailPanel(): HTMLElement | null {
  const selectors = [
    ".jobs-search__job-details--container",
    ".jobs-search__job-details",
    ".job-details-jobs-unified-top-card",
    ".jobs-unified-top-card",
  ];

  for (const selector of selectors) {
    for (const panel of queryAllDeep<HTMLElement>(document, selector)) {
      if (panelContainsSduiListCards(panel)) continue;
      return panel;
    }
  }

  const jobViewLink = findSearchResultsDetailJobViewLink();
  if (jobViewLink) {
    let current: HTMLElement | null = jobViewLink.parentElement;
    while (current && current !== document.body) {
      const hasCompanyLink = queryAllDeep<HTMLAnchorElement>(current, 'a[href*="/company/"]').some(
        (link) => !isInsideListJobCard(link)
      );
      if (hasCompanyLink) {
        return current;
      }
      current = current.parentElement;
    }
  }

  for (const link of queryAllDeep<HTMLAnchorElement>(
    document,
    'a[href*="/company/"][aria-label*="Entreprise"]'
  )) {
    if (isInsideListJobCard(link)) continue;

    let current: HTMLElement | null = link.parentElement;
    while (current && current !== document.body) {
      const jobView = findSearchResultsDetailJobViewLink();
      if (jobView && current.contains(jobView)) {
        return current;
      }
      current = current.parentElement;
    }
  }

  return null;
}

export function findCompanyInJobDetailPanel(
  panel: HTMLElement,
  registry: CompanyRegistry
): { element: HTMLElement; company: Company } | null {
  const linkMatch = findBestDetailCompanyLink(
    queryAllDeep<HTMLAnchorElement>(panel, 'a[href*="/company/"]'),
    registry
  );
  if (linkMatch) return linkMatch;

  const fromSelectors = findCompanyNameElementFromSelectors(panel);
  if (fromSelectors && !isInsideListJobCard(fromSelectors)) {
    const company = findCompanyByName(registry, fromSelectors.textContent?.trim() ?? "");
    if (company) {
      return { element: fromSelectors, company };
    }
  }

  const sduiName = findCompanyNameInSduiCard(panel, { excludeListCards: true });
  if (sduiName) {
    const company = findCompanyByName(registry, sduiName.textContent?.trim() ?? "");
    if (company) {
      return { element: sduiName, company };
    }
  }

  const title =
    panel.querySelector<HTMLElement>("h1") ??
    panel.querySelector<HTMLElement>("h2") ??
    queryDeep<HTMLElement>(panel, ".job-details-jobs-unified-top-card__job-title") ??
    queryDeep<HTMLElement>(panel, ".jobs-unified-top-card__job-title") ??
    findSearchResultsDetailJobViewLink() ??
    findSduiJobTitleInCard(panel);

  if (title && !isInsideListJobCard(title)) {
    const structural = findNextLineAfterTitle(panel, title);
    if (structural && !isInsideListJobCard(structural)) {
      const company = findCompanyByName(registry, structural.textContent?.trim() ?? "");
      if (company) {
        return { element: structural, company };
      }
    }
  }

  const titleForTextMatch = findJobTitleInContainer(panel) ?? findSduiJobTitleInCard(panel);
  for (const company of Object.values(registry)) {
    const target = normalizeCompanyName(company.name);
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    let textNode: Node | null = null;

    while ((textNode = walker.nextNode())) {
      const text = collapseText(textNode.textContent ?? "");
      if (normalizeCompanyName(text) !== target) continue;

      const parent = textNode.parentElement;
      if (!parent || isInsideListJobCard(parent)) continue;
      if (titleForTextMatch && (titleForTextMatch.contains(parent) || parent.contains(titleForTextMatch))) {
        continue;
      }
      if (parent.closest('a[href*="/jobs/view/"]')) continue;

      return { element: parent, company };
    }
  }

  return null;
}

function findSduiJobTitleInCard(card: HTMLElement): HTMLElement | null {
  for (const paragraph of Array.from(card.querySelectorAll("p"))) {
    const text = collapseText(paragraph.textContent ?? "");
    if (/engineer|developer|manager|fullstack|architect|consultant|designer|analyst|offre d'emploi/i.test(text)) {
      return paragraph;
    }
  }
  return null;
}

export function findCompanyElementInCardByTextMatch(
  card: HTMLElement,
  registry: CompanyRegistry
): { element: HTMLElement; company: Company } | null {
  const title = findJobTitleInContainer(card) ?? findSduiJobTitleInCard(card);

  for (const company of Object.values(registry)) {
    const target = normalizeCompanyName(company.name);
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    let textNode: Node | null = null;

    while ((textNode = walker.nextNode())) {
      const text = collapseText(textNode.textContent ?? "");
      if (normalizeCompanyName(text) !== target) continue;

      const parent = textNode.parentElement;
      if (!parent) continue;
      if (title && (title.contains(parent) || parent.contains(title))) continue;
      if (parent.closest('a[href*="/jobs/view/"]')) continue;

      return { element: parent, company };
    }
  }

  return null;
}

function keepInnermostCards(cards: HTMLElement[]): HTMLElement[] {
  return cards.filter((card) => !cards.some((other) => other !== card && card.contains(other)));
}

const TRACKER_COMPANY_LOCATION_SEPARATOR = "·";

function extractCompanyNameFromTrackerLine(text: string): string | null {
  const value = collapseText(text);
  const separatorIndex = value.indexOf(TRACKER_COMPANY_LOCATION_SEPARATOR);
  if (separatorIndex <= 0) return null;

  const name = stripLeadingIndicatorIcon(value.slice(0, separatorIndex).trim());
  if (!name || name.length > 80) return null;
  if (isSduiMetaParagraph(name)) return null;
  return name;
}

function findJobsTrackerCompanyLine(card: HTMLElement): HTMLElement | null {
  for (const paragraph of Array.from(card.querySelectorAll("p"))) {
    if (extractCompanyNameFromTrackerLine(paragraph.textContent ?? "")) {
      return paragraph;
    }
  }
  return null;
}

function isJobsTrackerJobCard(link: HTMLAnchorElement): boolean {
  if (!/\/jobs\/view\//i.test(link.href)) return false;
  return findJobsTrackerCompanyLine(link) !== null;
}

function findJobsTrackerCards(): HTMLElement[] {
  const cards: HTMLElement[] = [];

  for (const link of queryAllDeep<HTMLAnchorElement>(document, 'a[href*="/jobs/view/"]')) {
    if (isJobsTrackerJobCard(link)) {
      cards.push(link);
    }
  }

  return keepInnermostCards(cards);
}

function findTextNodeContaining(root: Node, value: string): Text | null {
  const visit = (node: Node): Text | null => {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").includes(value)) {
      return node as Text;
    }

    for (const child of Array.from(node.childNodes)) {
      const found = visit(child);
      if (found) return found;
    }

    return null;
  };

  return visit(root);
}

export function wrapCompanyNamePrefix(element: HTMLElement, companyName: string): HTMLElement {
  const existing = element.querySelector<HTMLElement>("[data-li-tracker-company-wrap]");
  if (existing) return existing;

  const textNode = findTextNodeContaining(element, companyName);
  if (!textNode) return element;

  const text = textNode.textContent ?? "";
  const index = text.indexOf(companyName);
  if (index < 0) return element;

  const parent = textNode.parentNode;
  if (!parent) return element;

  const doc = element.ownerDocument;
  const span = doc.createElement("span");
  span.setAttribute("data-li-tracker-company-wrap", "true");
  span.textContent = companyName;

  const before = text.slice(0, index);
  const after = text.slice(index + companyName.length);

  if (before) parent.insertBefore(doc.createTextNode(before), textNode);
  parent.insertBefore(span, textNode);
  if (after) parent.insertBefore(doc.createTextNode(after), textNode);
  parent.removeChild(textNode);

  return span;
}

export function findCompanyInJobsTrackerCard(
  card: HTMLElement,
  registry: CompanyRegistry
): { element: HTMLElement; company: Company; displayName: string } | null {
  const line = findJobsTrackerCompanyLine(card);
  if (!line) return null;

  const displayName = extractCompanyNameFromTrackerLine(line.textContent ?? "");
  if (!displayName) return null;

  const company = findCompanyByName(registry, displayName);
  if (!company) return null;

  return { element: line, company, displayName };
}

export function findJobCards(root: ParentNode = document): HTMLElement[] {
  if (isJobsSearchResultsPage()) {
    return findListJobCardsExcludingDetail();
  }

  if (isJobsTrackerPage()) {
    return findJobsTrackerCards();
  }

  const cards = collectJobCardsInRoot(root);
  return keepInnermostCards(cards);
}

const JOB_VIEW_CONTAINER_SELECTORS = [
  ".job-details-jobs-unified-top-card",
  ".jobs-unified-top-card",
  ".jobs-details__main-content",
  ".jobs-search__job-details--container",
  ".jobs-search__job-details",
  '[class*="jobs-details"]',
  "main",
];

export function findJobViewContainer(): HTMLElement | null {
  if (isJobsSearchResultsPage()) {
    return findSearchResultsDetailPanel();
  }

  for (const selector of JOB_VIEW_CONTAINER_SELECTORS) {
    for (const container of queryAllDeep<HTMLElement>(document, selector)) {
      if (findCompanyNameElement(container) || findCompanyNameInSduiCard(container)) {
        return container;
      }
    }
  }
  return null;
}

function isJobsSearchPage(): boolean {
  return (
    /^\/jobs\/search(?:\/|$)/i.test(window.location.pathname) ||
    isJobsSearchResultsPage()
  );
}

function isJobsViewPage(): boolean {
  return /^\/jobs\/view/i.test(window.location.pathname);
}

export function isJobsPage(): boolean {
  return isJobsSearchPage() || isJobsViewPage() || isJobsTrackerPage();
}
