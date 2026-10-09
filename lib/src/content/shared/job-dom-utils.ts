// deps

  // locals
  import { stripLeadingIndicatorIcon } from "../../types/indicator";
  import { extractLinkedinCodeFromHref } from "./linkedin-url";
  import { queryAllDeep, queryDeep } from "./dom-query";

// types & interfaces

  // locals
  import type { Company, CompanyRegistry } from "../../types/company";

// consts

  const COMPANY_NAME_TEXT_SELECTORS = [
    "h4.base-search-card__subtitle",
    ".base-search-card__subtitle",
    ".job-card-container__primary-description",
    ".job-card-container__company-name",
    ".artdeco-entity-lockup__subtitle",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
    "a.hidden-nested-link[href*=\"/company/\"]",
    "[class*=\"company-name\"]",
    "[class*=\"primary-description\"]",
    "[class*=\"subtitle\"]"
  ];

  const JOB_CARD_SELECTORS = [
    "li.jobs-search-results__list-item",
    "li.scaffold-layout__list-item",
    "ul.jobs-search__results-list > li",
    "div.job-card-container",
    "[data-job-id]",
    ".base-card",
    ".base-search-card",
    "div[role=\"listitem\"]",
    "li[class*=\"jobs-search-results\"]",
    "div[class*=\"job-card-container\"]"
  ];

  const JOB_CARD_ANCESTOR_SELECTORS = [
    "div[role=\"listitem\"]",
    "li",
    ".base-card",
    ".base-search-card",
    ".job-card-container",
    "[class*=\"job-card\"]",
    "[class*=\"search-card\"]"
  ];

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
    "[class*=\"job-card\"] h3 a",
    "[class*=\"job-card\"] a[class*=\"title\"]",
    "a[href*=\"/jobs/view/\"]"
  ];

  const JOB_DETAIL_PANEL_SELECTORS = [
    ".jobs-search__job-details--container",
    ".jobs-search__job-details",
    ".job-details-jobs-unified-top-card",
    ".jobs-unified-top-card",
    "[class*=\"jobs-details\"]"
  ];

  const TRACKER_COMPANY_LOCATION_SEPARATOR = "·";

  const JOB_VIEW_CONTAINER_SELECTORS = [
    ".job-details-jobs-unified-top-card",
    ".jobs-unified-top-card",
    ".jobs-details__main-content",
    ".jobs-search__job-details--container",
    ".jobs-search__job-details",
    "[class*=\"jobs-details\"]",
    "main"
  ];

// private

  // methods

  function _normalizeCompanyName (name: string): string {

    return name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");

  }

  function _trimmedText (element: Element | null | undefined): string {
    return element?.textContent.trim() ?? "";
  }

  function _collapseText (text: string): string {
    return text.trim().replace(/\s+/g, " ");
  }

  function _isLikelyLocationOrMeta (text: string): boolean {

    const value = _collapseText(text);
    if (!value) {
      return true;
    }

    if (/^(remote|hybrid|on-site|télétravail|sur site)/i.test(value)) {
      return true;
    }

    if (/\((?:sur site|hybrid|remote|télétravail)\)/i.test(value)) {
      return true;
    }

    if (/^(be an early applicant|actively hiring|candidature simplifiée)/i.test(value)) {
      return true;
    }

    if (/\b\d+\s+(hour|day|week|month|jour|semaine|mois|heure)s?\s+ago\b/i.test(value)) {
      return true;
    }

    if (value.includes("·")) {
      return true;
    }

    if (/^[A-Za-zÀ-ÿ0-9\s.'-]+,\s*[A-Za-zÀ-ÿ0-9\s.'-]+(?:,\s*[A-Za-zÀ-ÿ0-9\s.'-]+)?$/.test(value)) {
      return true;
    }

    return false;

  }

  function _isSameOrNested (a: Node, b: Node): boolean {
    return a === b || a.contains(b) || b.contains(a);
  }

  function _findCompanyNameElementFromSelectors (container: ParentNode): HTMLElement | null {

    const link = _findCompanyLinkInContainer(container);
    if (null !== link && "" !== _trimmedText(link)) {
      return link;
    }

    for (const selector of COMPANY_NAME_TEXT_SELECTORS) {

      const element = container.querySelector<HTMLElement>(selector);

      if (null !== element && "" !== _trimmedText(element)) {

        const nestedLink = element.querySelector<HTMLAnchorElement>("a");

        if (null !== nestedLink && "" !== _trimmedText(nestedLink)) {
          return nestedLink;
        }

        return element;

      }

    }

    const h4 = container.querySelector("h4");
    if (null !== h4 && "" !== _trimmedText(h4)) {
      return h4.querySelector("a") ?? h4;
    }

    return null;
  }

  function _findNextLineAfterTitle (card: HTMLElement, title: HTMLElement): HTMLElement | null {

    const blocks = Array.from(
      card.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, p, a, span, div")
    );

    let passedTitle = false;
    for (const block of blocks) {

      if (!passedTitle) {

        if (_isSameOrNested(block, title)) {
          passedTitle = true;
        }

      }
      else if (!title.contains(block)) {

        const text = _collapseText(block.textContent);

        if ("" !== text && 100 >= text.length) {

          if (_isLikelyLocationOrMeta(text)) {
            break;
          }

          const companyLink = block.querySelector<HTMLAnchorElement>("a[href*=\"/company/\"]");
          if (null !== companyLink && "" !== _trimmedText(companyLink)) {
            return companyLink;
          }

          if (block.matches("h4, h5, p, span, a")) {
            return block.querySelector("a") ?? block;
          }

          if (1 >= block.children.length) {
            return block;
          }

        }

      }

    }

    return null;

  }

  function _isSduiMetaParagraph (text: string): boolean {

    const value = _collapseText(text);
    if (!value) {
      return true;
    }

    if (/consulté|premiers candidats|meilleurs candidats|candidature simplifiée|publication il y a|vous seriez parmi|offre d'emploi vérifiée|·/i.test(value)) {
      return true;
    }

    return false;

  }

  function _isCompanyNameText (text: string): boolean {

    const value = _collapseText(text);

    if (!value || 80 < value.length) {
      return false;
    }

    if (_isLikelyLocationOrMeta(value)) {
      return false;
    }

    if (_isSduiMetaParagraph(value)) {
      return false;
    }

    if (/engineer|developer|manager|fullstack|architect|consultant/i.test(value)) {
      return false;
    }

    return true;

  }

  function _isSduiJobCard (card: HTMLElement): boolean {
    const key = card.getAttribute("componentkey") ?? "";
    return key.startsWith("job-card-component-ref-");
  }

  function _isInsideListJobCard (element: HTMLElement): boolean {
    return null !== element.closest("[componentkey^=\"job-card-component-ref-\"]");
  }

  /** Company line in SDUI job cards: div > p with short name (e.g. "Sander"). */
  function _findCompanyNameInSduiCard (
    card: HTMLElement,
    options: { "excludeListCards"?: boolean } = {}
  ): HTMLElement | null {

    const excludeListCards = true === options.excludeListCards;
    const candidates: HTMLElement[] = [];

    for (const div of Array.from(card.querySelectorAll("div"))) {

      if (!(excludeListCards && _isInsideListJobCard(div))) {

        const directParagraphs = Array.from(div.children).filter((child) => {
          return "P" === child.tagName;
        });

        if (1 === directParagraphs.length) {

          const paragraph = directParagraphs[0] as HTMLElement;

          if (!(excludeListCards && _isInsideListJobCard(paragraph)) && _isCompanyNameText(paragraph.textContent)) {
            candidates.push(paragraph);
          }

        }

      }

    }

    if (0 === candidates.length) {

      for (const paragraph of Array.from(card.querySelectorAll("p"))) {

        if (!(excludeListCards && _isInsideListJobCard(paragraph)) && _isCompanyNameText(paragraph.textContent)) {
          candidates.push(paragraph);
        }

      }

    }

    if (0 === candidates.length) {
      return null;
    }

    if (1 === candidates.length) {
      return candidates[0];
    }

    for (const paragraph of candidates) {

      let sibling = paragraph.parentElement?.nextElementSibling;

      while (sibling) {

        if (sibling instanceof HTMLElement) {

          const text = _collapseText(sibling.textContent);

          if (text && _isLikelyLocationOrMeta(text)) {
            return paragraph;
          }

        }

        sibling = sibling.nextElementSibling;

      }

    }

    return candidates[0];
  }

  function _findCompanyNameText (container: ParentNode): string | null {
    const text = _trimmedText(findCompanyNameElement(container));
    return "" === text ? null : text;
  }

  function _findCompanyLinkInContainer (container: ParentNode): HTMLAnchorElement | null {

    const companyNameSelectors = [
      "a.hidden-nested-link[href*='/company/']",
      ".job-card-container__company-name a",
      ".job-card-container__primary-description a",
      ".artdeco-entity-lockup__subtitle a",
      ".base-search-card__subtitle a",
      "h4.base-search-card__subtitle a",
      "[class*=\"company-name\"] a",
      ".job-details-jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name a",
      "a[href*=\"/company/\"]"
    ];

    for (const selector of companyNameSelectors) {

      const link = container.querySelector<HTMLAnchorElement>(selector);
      if (_trimmedText(link)) {
        return link;
      }

    }

    return null;

  }

  function _findJobTitleInContainer (container: ParentNode): HTMLElement | null {

    for (const selector of JOB_TITLE_SELECTORS) {

      const element = container.querySelector<HTMLElement>(selector);
      if (_trimmedText(element)) {
        return element;
      }

    }

    return null;

  }

  function _isJobCardCandidate (card: HTMLElement): boolean {

    return null !== _findJobTitleInContainer(card)
      || null !== findCompanyNameElement(card)
      || null !== _findCompanyLinkInContainer(card)
      || null !== card.querySelector("a[href*=\"/jobs/view/\"]");

  }

  function _findJobCardsFromViewLinks (root: ParentNode): HTMLElement[] {

    const cards: Set<HTMLElement> = new Set();

    for (const link of Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href*=\"/jobs/view/\"]"))) {

      if ("" !== link.textContent.trim()) {

        const card = link.closest(JOB_CARD_ANCESTOR_SELECTORS.join(", "));
        if (card instanceof HTMLElement && _isJobCardCandidate(card)) {
          cards.add(card);
        }

      }

    }

    return [ ...cards ];

  }

  function _collectJobCardsInRoot (root: ParentNode): HTMLElement[] {

    const cards: Set<HTMLElement> = new Set();

    if (isJobsSearchResultsPage()) {

      root.querySelectorAll<HTMLElement>("div[role=\"listitem\"]").forEach((item) => {
        if (item.querySelector("a[href*=\"/jobs/view/\"]")) {
          cards.add(item);
        }
      });

    }

    for (const selector of JOB_CARD_SELECTORS) {

      root.querySelectorAll<HTMLElement>(selector).forEach((card) => {
        if (_isJobCardCandidate(card)) {
          cards.add(card);
        }
      });

    }

    _findJobCardsFromViewLinks(root).forEach((card) => {
      cards.add(card);
    });

    return [ ...cards ];

  }

  function _panelContainsSduiListCards (panel: HTMLElement): boolean {
    return null !== panel.querySelector("[componentkey^=\"job-card-component-ref-\"]");
  }

  function _findJobDetailPanel (): HTMLElement | null {

    for (const selector of JOB_DETAIL_PANEL_SELECTORS) {

      for (const panel of queryAllDeep<HTMLElement>(document, selector)) {

        if (!(isJobsSearchResultsPage() && _panelContainsSduiListCards(panel))) {
          return panel;
        }

      }

    }

    return null;

  }

  function _findCardFromJobLink (link: HTMLAnchorElement): HTMLElement | null {

    const fromClosest = link.closest(JOB_CARD_ANCESTOR_SELECTORS.join(", "));
    if (fromClosest instanceof HTMLElement) {
      return fromClosest;
    }

    let current: HTMLElement | null = link.parentElement;
    while (current) {

      const jobLinks = current.querySelectorAll("a[href*=\"/jobs/view/\"]");
      if (1 === jobLinks.length && jobLinks[0] === link) {
        return current;
      }

      current = current.parentElement;

    }

    return link.parentElement;

  }

  function _isInsideJobDetailPanel (element: HTMLElement, detailPanel: HTMLElement | null): boolean {

    if (true !== detailPanel?.contains(element)) {
      return false;
    }
    if (!isJobsSearchResultsPage()) {
      return true;
    }

    const card = element.closest("[componentkey^=\"job-card-component-ref-\"]");
    return !card || detailPanel.contains(card);

  }

  /** Cards in the left list, excluding the detail panel on the right. */
  function _findListJobCardsExcludingDetail (): HTMLElement[] {

    const detailPanel = _findJobDetailPanel();
    const cards: Set<HTMLElement> = new Set();

    const sduiSelectors = [
      "[role=\"button\"][componentkey^=\"job-card-component-ref-\"]",
      "[componentkey^=\"job-card-component-ref-\"]"
    ];

    for (const selector of sduiSelectors) {

      for (const item of queryAllDeep<HTMLElement>(document, selector)) {

        if (!_isInsideJobDetailPanel(item, detailPanel)) {
          cards.add(item);
        }

      }

    }

    for (const wrapper of queryAllDeep<HTMLElement>(document, "[data-display-contents=\"true\"]")) {

      const card = wrapper.querySelector<HTMLElement>("[componentkey^=\"job-card-component-ref-\"]");
      if (null !== card && !_isInsideJobDetailPanel(card, detailPanel)) {
        cards.add(card.closest<HTMLElement>("[role=\"button\"]") ?? card);
      }

    }

    const listItemSelectors = [
      "div[role=\"listitem\"]",
      "li.scaffold-layout__list-item",
      "li.jobs-search-results__list-item",
      ".job-card-container",
      ".base-card",
      ".base-search-card"
    ];

    for (const selector of listItemSelectors) {

      for (const item of queryAllDeep<HTMLElement>(document, selector)) {

        if (!_isInsideJobDetailPanel(item, detailPanel)) {
          cards.add(item);
        }

      }

    }

    for (const link of queryAllDeep<HTMLAnchorElement>(document, "a[href*=\"/jobs/view/\"]")) {

      if (!_isInsideJobDetailPanel(link, detailPanel)) {

        const card = _findCardFromJobLink(link);
        if (card && !_isInsideJobDetailPanel(card, detailPanel)) {
          cards.add(card);
        }

      }

    }

    return _keepInnermostCards([ ...cards ]);

  }

  function _parseEntrepriseAriaLabel (label: string | null): string | null {

    if (null === label || "" === label) {
      return null;
    }

    const match = /entreprise,?\s*(.+?)\.?$/i.exec(label);
    return match ? _collapseText(match[1]) : null;

  }

  function _isDetailJobTitleText (text: string): boolean {

    return /engineer|developer|manager|fullstack|architect|consultant|designer|analyst|lead|développeur|ingénieur/i.test(
      _collapseText(text)
    );

  }

  function _findSearchResultsDetailJobViewLink (): HTMLAnchorElement | null {

    for (const link of queryAllDeep<HTMLAnchorElement>(document, "a[href*=\"/jobs/view/\"]")) {

      if (!_isInsideListJobCard(link)) {

        const text = _collapseText(link.textContent);
        if ("" !== text && !_isSduiMetaParagraph(text) && _isDetailJobTitleText(text)) {
          return link;
        }

      }

    }

    return null;

  }

  function _findBestDetailCompanyLink (
    links: HTMLAnchorElement[],
    registry: CompanyRegistry
  ): { "element": HTMLElement; "company": Company } | null {

    const filtered = links.filter(
      (link) => {
        return !_isInsideListJobCard(link)
          && !/\/insights\/|\/posts\//i.test(link.href);
      }
    );

    const ranked = filtered.sort(
      (a, b) => {
        return _collapseText(a.textContent).length - _collapseText(b.textContent).length;
      }
    );

    for (const link of ranked) {

      const name = _collapseText(link.textContent);
      const isCandidate = "" !== name
        && 80 >= name.length
        && !_isLikelyLocationOrMeta(name)
        && !_isSduiMetaParagraph(name)
        && !_isDetailJobTitleText(name);

      if (isCandidate) {

        const company = findCompanyByName(registry, name);
        if (company) {
          return { "element": link, company };
        }

        const code = extractLinkedinCodeFromHref(link.href);
        if (null !== code && Object.hasOwn(registry, code)) {
          return { "element": link, "company": registry[code] };
        }

      }

    }

    return null;

  }

  function _findSearchResultsDetailPanel (): HTMLElement | null {

    const selectors = [
      ".jobs-search__job-details--container",
      ".jobs-search__job-details",
      ".job-details-jobs-unified-top-card",
      ".jobs-unified-top-card"
    ];

    for (const selector of selectors) {

      for (const panel of queryAllDeep<HTMLElement>(document, selector)) {

        if (!_panelContainsSduiListCards(panel)) {
          return panel;
        }

      }

    }

    const jobViewLink = _findSearchResultsDetailJobViewLink();
    if (jobViewLink) {

      let current: HTMLElement | null = jobViewLink.parentElement;
      while (current && current !== document.body) {

        const hasCompanyLink = queryAllDeep<HTMLAnchorElement>(current, "a[href*=\"/company/\"]").some(
          (link) => {
            return !_isInsideListJobCard(link);
          }
        );

        if (hasCompanyLink) {
          return current;
        }

        current = current.parentElement;

      }

    }

    for (const link of queryAllDeep<HTMLAnchorElement>(
      document,
      "a[href*=\"/company/\"][aria-label*=\"Entreprise\"]"
    )) {

      if (!_isInsideListJobCard(link)) {

        let current: HTMLElement | null = link.parentElement;
        while (current && current !== document.body) {

          const jobView = _findSearchResultsDetailJobViewLink();
          if (jobView && current.contains(jobView)) {
            return current;
          }

          current = current.parentElement;

        }

      }

    }

    return null;

  }

  function _findSduiJobTitleInCard (card: HTMLElement): HTMLElement | null {

    for (const paragraph of Array.from(card.querySelectorAll("p"))) {

      const text = _collapseText(paragraph.textContent);
      if (/engineer|developer|manager|fullstack|architect|consultant|designer|analyst|offre d'emploi/i.test(text)) {
        return paragraph;
      }

    }

    return null;

  }

  function _keepInnermostCards (cards: HTMLElement[]): HTMLElement[] {

    return cards.filter((card) => {

      return !cards.some((other) => {
        return other !== card && card.contains(other);
      });

    });

  }

  function _extractCompanyNameFromTrackerLine (text: string): string | null {

    const value = _collapseText(text);
    const separatorIndex = value.indexOf(TRACKER_COMPANY_LOCATION_SEPARATOR);
    if (0 >= separatorIndex) {
      return null;
    }

    const name = stripLeadingIndicatorIcon(value.slice(0, separatorIndex).trim());
    if (!name || 80 < name.length) {
      return null;
    }
    if (_isSduiMetaParagraph(name)) {
      return null;
    }

    return name;

  }

  function _findJobsTrackerCompanyLine (card: HTMLElement): HTMLElement | null {

    for (const paragraph of Array.from(card.querySelectorAll("p"))) {

      if (null !== _extractCompanyNameFromTrackerLine(paragraph.textContent)) {
        return paragraph;
      }

    }

    return null;

  }

  function _isJobsTrackerJobCard (link: HTMLAnchorElement): boolean {

    if (!/\/jobs\/view\//i.test(link.href)) {
      return false;
    }

    return null !== _findJobsTrackerCompanyLine(link);

  }

  function _findJobsTrackerCards (): HTMLElement[] {

    const cards: HTMLElement[] = [];

    for (const link of queryAllDeep<HTMLAnchorElement>(document, "a[href*=\"/jobs/view/\"]")) {

      if (_isJobsTrackerJobCard(link)) {
        cards.push(link);
      }

    }

    return _keepInnermostCards(cards);

  }

  function _findTextNodeContaining (root: Node, value: string): Text | null {

    function visit (node: Node): Text | null {

      if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").includes(value)) {
        return node as Text;
      }

      for (const child of Array.from(node.childNodes)) {

        const found = visit(child);
        if (found) {
          return found;
        }

      }

      return null;

    }

    return visit(root);

  }

  function _isJobsSearchPage (): boolean {

    return (
      /^\/jobs\/search(?:\/|$)/i.test(window.location.pathname)
      || isJobsSearchResultsPage()
    );

  }

  function _isJobsViewPage (): boolean {
    return /^\/jobs\/view/i.test(window.location.pathname);
  }

// module

export { extractLinkedinCodeFromHref };

export function findCompanyByName (
  registry: CompanyRegistry,
  name: string
): Company | undefined {

  const normalized = _normalizeCompanyName(stripLeadingIndicatorIcon(name));
  if (!normalized) {
    return undefined;
  }

  return Object.values(registry).find(
    (company) => {
      return _normalizeCompanyName(company.name) === normalized;
    }
  );

}

export function isJobsSearchResultsPage (): boolean {
  return /^\/jobs\/search-results(?:\/|$)/i.test(window.location.pathname);
}

export function isJobsTrackerPage (): boolean {
  return /^\/jobs-tracker(?:\/|$)/i.test(window.location.pathname);
}

export function findCompanyInSduiCard (
  card: HTMLElement,
  registry: CompanyRegistry
): { "element": HTMLElement; "company": Company } | null {

  const nameElement = _findCompanyNameInSduiCard(card);

  if (!nameElement) {
    return null;
  }

  const company = findCompanyByName(registry, nameElement.textContent.trim());
  if (!company) {
    return null;
  }

  return { "element": nameElement, company };

}

/** Company line in left list cards (between title and location). */
export function findCompanyNameElementInListCard (card: HTMLElement): HTMLElement | null {

  if (_isSduiJobCard(card) || card.querySelector("[componentkey^=\"job-card-component-ref-\"]")) {

    const sduiName = _findCompanyNameInSduiCard(card);

    if (sduiName) {
      return sduiName;
    }

  }

  const title = _findJobTitleInContainer(card);
  const fromSelectors = _findCompanyNameElementFromSelectors(card);

  if (fromSelectors && title && !_isSameOrNested(fromSelectors, title)) {

    const text = _collapseText(fromSelectors.textContent);
    if (text && !_isLikelyLocationOrMeta(text)) {
      return fromSelectors;
    }

  }

  if (title) {

    const titleBlock = title.closest("h3, h2, h4, a") ?? title;
    const rowContainer = titleBlock.parentElement;

    if (rowContainer) {

      const siblings = Array.from(rowContainer.children);
      const titleIndex = siblings.findIndex(
        (node) => {
          return node.contains(titleBlock) || node === titleBlock;
        }
      );

      if (0 <= titleIndex) {

        for (let index = titleIndex + 1; index < siblings.length; index += 1) {

          const sibling = siblings[index];
          const text = sibling instanceof HTMLElement ? _collapseText(sibling.textContent) : "";

          if (sibling instanceof HTMLElement && "" !== text) {

            if (_isLikelyLocationOrMeta(text)) {
              break;
            }

            const companyLink = sibling.querySelector<HTMLAnchorElement>("a[href*=\"/company/\"]");
            if (null !== companyLink && "" !== _trimmedText(companyLink)) {
              return companyLink;
            }

            return sibling.querySelector("a") ?? sibling;

          }

        }

      }

    }

    const h3 = card.querySelector("h3");
    const h4 = h3?.nextElementSibling;

    if (h4 instanceof HTMLElement) {

      const text = _collapseText(h4.textContent);
      if (text && !_isLikelyLocationOrMeta(text)) {
        return h4.querySelector("a") ?? h4;
      }

    }

    const structural = _findNextLineAfterTitle(card, title);
    if (structural) {
      return structural;
    }

  }

  return fromSelectors;

}

/** Element that displays the company name (link preferred). */
export function findCompanyNameElement (container: ParentNode): HTMLElement | null {
  return _findCompanyNameElementFromSelectors(container);
}

/** Resolve a tracked company from a job card / detail container. */
export function resolveCompanyFromContainer (
  container: ParentNode,
  registry: CompanyRegistry
): Company | undefined {

  const link = _findCompanyLinkInContainer(container);
  if (link) {

    const code = extractLinkedinCodeFromHref(link.href);
    if (null !== code && Object.hasOwn(registry, code)) {
      return registry[code];
    }

    const linkName = link.textContent.trim();
    if (linkName) {

      const byLinkName = findCompanyByName(registry, linkName);
      if (byLinkName) {
        return byLinkName;
      }

    }

  }

  if (container instanceof HTMLElement) {

    const sduiName = _findCompanyNameInSduiCard(container);
    if (sduiName) {

      const bySduiName = findCompanyByName(registry, sduiName.textContent.trim());
      if (bySduiName) {
        return bySduiName;
      }

    }

    const listName = findCompanyNameElementInListCard(container);
    if (listName) {

      const byListName = findCompanyByName(registry, listName.textContent.trim());
      if (byListName) {
        return byListName;
      }

    }

  }

  const nameText = _findCompanyNameText(container);
  if (null !== nameText) {
    return findCompanyByName(registry, nameText);
  }

  return undefined;

}

export function findCompanyInSearchResultsDetail (
  registry: CompanyRegistry
): { "element": HTMLElement; "company": Company } | null {

  const entrepriseLinks = queryAllDeep<HTMLAnchorElement>(
    document,
    "a[href*=\"/company/\"][aria-label*=\"Entreprise\"], a[href*=\"/company/\"][componentkey^=\"auto-binding\"]"
  );

  for (const link of entrepriseLinks) {

    if (!_isInsideListJobCard(link)) {

      const innerLink = link.querySelector<HTMLAnchorElement>("a[href*=\"/company/\"]") ?? link;
      const collapsedName = _collapseText(innerLink.textContent);
      const name = "" === collapsedName
        ? _parseEntrepriseAriaLabel(link.getAttribute("aria-label")) ?? ""
        : collapsedName;

      const company = findCompanyByName(registry, name);
      if (company) {
        return { "element": innerLink, company };
      }

      const code = extractLinkedinCodeFromHref(innerLink.href);
      if (null !== code && Object.hasOwn(registry, code)) {
        return { "element": innerLink, "company": registry[code] };
      }

    }

  }

  const detailJobLink = _findSearchResultsDetailJobViewLink();
  const companyLinks = queryAllDeep<HTMLAnchorElement>(document, "a[href*=\"/company/\"]").filter(
    (link) => {
      return !_isInsideListJobCard(link);
    }
  );

  if (detailJobLink) {

    const nearDetail = companyLinks.filter(
      (link) => {
        // Test du bit DOCUMENT_POSITION_FOLLOWING (puissance de 2) sans opérateur bit à bit.
        const position = link.compareDocumentPosition(detailJobLink);
        const quotient = Math.floor(position / Node.DOCUMENT_POSITION_FOLLOWING);
        return 1 === quotient % 2;
      }
    );

    const nearMatch = _findBestDetailCompanyLink(nearDetail, registry);
    if (nearMatch) {
      return nearMatch;
    }

  }

  return _findBestDetailCompanyLink(companyLinks, registry);

}

export function findCompanyInJobDetailPanel (
  panel: HTMLElement,
  registry: CompanyRegistry
): { "element": HTMLElement; "company": Company } | null {

  const linkMatch = _findBestDetailCompanyLink(
    queryAllDeep<HTMLAnchorElement>(panel, "a[href*=\"/company/\"]"),
    registry
  );
  if (linkMatch) {
    return linkMatch;
  }

  const fromSelectors = _findCompanyNameElementFromSelectors(panel);
  if (fromSelectors && !_isInsideListJobCard(fromSelectors)) {
    const company = findCompanyByName(registry, fromSelectors.textContent.trim());
    if (company) {
      return { "element": fromSelectors, company };
    }
  }

  const sduiName = _findCompanyNameInSduiCard(panel, { "excludeListCards": true });
  if (sduiName) {
    const company = findCompanyByName(registry, sduiName.textContent.trim());
    if (company) {
      return { "element": sduiName, company };
    }
  }

  const title
    = panel.querySelector<HTMLElement>("h1")
    ?? panel.querySelector<HTMLElement>("h2")
    ?? queryDeep<HTMLElement>(panel, ".job-details-jobs-unified-top-card__job-title")
    ?? queryDeep<HTMLElement>(panel, ".jobs-unified-top-card__job-title")
    ?? _findSearchResultsDetailJobViewLink()
    ?? _findSduiJobTitleInCard(panel);

  if (title && !_isInsideListJobCard(title)) {

    const structural = _findNextLineAfterTitle(panel, title);
    if (structural && !_isInsideListJobCard(structural)) {

      const company = findCompanyByName(registry, structural.textContent.trim());
      if (company) {
        return { "element": structural, company };
      }

    }

  }

  const titleForTextMatch = _findJobTitleInContainer(panel) ?? _findSduiJobTitleInCard(panel);
  for (const company of Object.values(registry)) {

    const target = _normalizeCompanyName(company.name);
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    let textNode: Node | null = walker.nextNode();

    while (null !== textNode) {

      const text = _collapseText(textNode.textContent ?? "");
      const parent = textNode.parentElement;

      if (
        _normalizeCompanyName(text) === target
        && null !== parent
        && !_isInsideListJobCard(parent)
        && !(titleForTextMatch && (titleForTextMatch.contains(parent) || parent.contains(titleForTextMatch)))
        && null === parent.closest("a[href*=\"/jobs/view/\"]")
      ) {
        return { "element": parent, company };
      }

      textNode = walker.nextNode();

    }

  }

  return null;

}

export function findCompanyElementInCardByTextMatch (
  card: HTMLElement,
  registry: CompanyRegistry
): { "element": HTMLElement; "company": Company } | null {

  const title = _findJobTitleInContainer(card) ?? _findSduiJobTitleInCard(card);

  for (const company of Object.values(registry)) {

    const target = _normalizeCompanyName(company.name);
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);

    let textNode: Node | null = walker.nextNode();

    while (null !== textNode) {

      const text = _collapseText(textNode.textContent ?? "");
      const parent = textNode.parentElement;
      if (
        _normalizeCompanyName(text) === target
        && null !== parent
        && !(title && (title.contains(parent) || parent.contains(title)))
        && null === parent.closest("a[href*=\"/jobs/view/\"]")
      ) {
        return { "element": parent, company };
      }

      textNode = walker.nextNode();

    }

  }

  return null;

}

export function wrapCompanyNamePrefix (element: HTMLElement, companyName: string): HTMLElement {

  const existing = element.querySelector<HTMLElement>("[data-li-tracker-company-wrap]");
  if (existing) {
    return existing;
  }

  const textNode = _findTextNodeContaining(element, companyName);
  if (!textNode) {
    return element;
  }

  const text = textNode.textContent;
  const index = text.indexOf(companyName);
  if (0 > index) {
    return element;
  }

  const parent = textNode.parentNode;
  if (!parent) {
    return element;
  }

  const doc = element.ownerDocument;
  const span = doc.createElement("span");
  span.setAttribute("data-li-tracker-company-wrap", "true");
  span.textContent = companyName;

  const before = text.slice(0, index);
  const after = text.slice(index + companyName.length);

  if (before) {
    parent.insertBefore(doc.createTextNode(before), textNode);
  }

  parent.insertBefore(span, textNode);
  if (after) {
    parent.insertBefore(doc.createTextNode(after), textNode);
  }

  parent.removeChild(textNode);

  return span;

}

export function findCompanyInJobsTrackerCard (
  card: HTMLElement,
  registry: CompanyRegistry
): { "element": HTMLElement; "company": Company; "displayName": string } | null {

  const line = _findJobsTrackerCompanyLine(card);
  if (!line) {
    return null;
  }

  const displayName = _extractCompanyNameFromTrackerLine(line.textContent);
  if (null === displayName) {
    return null;
  }

  const company = findCompanyByName(registry, displayName);
  if (!company) {
    return null;
  }

  return { "element": line, company, displayName };

}

export function findJobCards (root: ParentNode = document): HTMLElement[] {

  if (isJobsSearchResultsPage()) {
    return _findListJobCardsExcludingDetail();
  }

  if (isJobsTrackerPage()) {
    return _findJobsTrackerCards();
  }

  const cards = _collectJobCardsInRoot(root);
  return _keepInnermostCards(cards);

}

export function findJobViewContainer (): HTMLElement | null {

  if (isJobsSearchResultsPage()) {
    return _findSearchResultsDetailPanel();
  }

  for (const selector of JOB_VIEW_CONTAINER_SELECTORS) {

    for (const container of queryAllDeep<HTMLElement>(document, selector)) {

      if (findCompanyNameElement(container) || _findCompanyNameInSduiCard(container)) {
        return container;
      }

    }

  }

  return null;

}

export function isJobsPage (): boolean {
  return _isJobsSearchPage() || _isJobsViewPage() || isJobsTrackerPage();
}
