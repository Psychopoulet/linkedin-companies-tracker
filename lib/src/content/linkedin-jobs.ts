// deps

  // locals
  import {
    findCompanyByName,
    findCompanyElementInCardByTextMatch,
    findCompanyInJobDetailPanel,
    findCompanyInJobsTrackerCard,
    findCompanyInSearchResultsDetail,
    findCompanyInSduiCard,
    findCompanyNameElement,
    findCompanyNameElementInListCard,
    findJobCards,
    findJobViewContainer,
    isJobsPage,
    isJobsSearchResultsPage,
    isJobsTrackerPage,
    resolveCompanyFromContainer,
    wrapCompanyNamePrefix
  } from "./shared/job-dom-utils";
  import { applyCompanyHighlight } from "./shared/highlighter";
  import { isAddCompanyModalOpen } from "./shared/modal";
  import { initPageScanner } from "./shared/page-scanner";
  import { getCachedRegistry, initRegistryListeners, loadRegistry, onRegistryChange } from "./shared/registry-client";

// types & interfaces

  // locals
  import type { Company, CompanyRegistry } from "../types/company";

// private

  // methods

  function _applyHighlightOnCompanyName (
    container: ParentNode,
    registry: CompanyRegistry,
    nameElement: HTMLElement,
    company?: Company
  ): void {

    const resolved
      = company
      ?? resolveCompanyFromContainer(container, registry)
      ?? undefined;

    applyCompanyHighlight(nameElement, resolved, resolved?.linkedinCode ?? "unknown");

  }

  function _applyJobCard (card: HTMLElement, registry: CompanyRegistry): void {

    if (isJobsTrackerPage()) {

      const match = findCompanyInJobsTrackerCard(card, registry);
      if (!match) {
        return;
      }

      const target = wrapCompanyNamePrefix(match.element, match.displayName);
      applyCompanyHighlight(target, match.company, match.company.linkedinCode);

      return;

    }

    if (isJobsSearchResultsPage()) {

      const sduiMatch = findCompanyInSduiCard(card, registry);
      if (sduiMatch) {
        applyCompanyHighlight(sduiMatch.element, sduiMatch.company, sduiMatch.company.linkedinCode);
        return;
      }

      const textMatch = findCompanyElementInCardByTextMatch(card, registry);
      if (textMatch) {
        applyCompanyHighlight(textMatch.element, textMatch.company, textMatch.company.linkedinCode);
        return;
      }

      const nameElement = findCompanyNameElementInListCard(card);
      if (!nameElement) {
        return;
      }

      const company = findCompanyByName(registry, nameElement.textContent.trim());
      applyCompanyHighlight(nameElement, company, company?.linkedinCode ?? "unknown");

      return;

    }

    const nameElement = isJobsSearchResultsPage()
      ? findCompanyNameElementInListCard(card)
      : findCompanyNameElement(card);

    if (!nameElement) {
      return;
    }

    _applyHighlightOnCompanyName(card, registry, nameElement);

  }

  function _applyJobDetail (registry: CompanyRegistry): void {

    if (isJobsSearchResultsPage()) {

      const detailMatch = findCompanyInSearchResultsDetail(registry);
      if (detailMatch) {

        applyCompanyHighlight(
          detailMatch.element,
          detailMatch.company,
          detailMatch.company.linkedinCode
        );

        return;

      }

    }

    const container = findJobViewContainer();
    if (!container) {
      return;
    }

    const panelMatch = findCompanyInJobDetailPanel(container, registry);
    if (panelMatch) {
      applyCompanyHighlight(
        panelMatch.element,
        panelMatch.company,
        panelMatch.company.linkedinCode
      );
      return;
    }

    const nameElement
      = findCompanyNameElement(container) ?? findCompanyNameElementInListCard(container);

    if (!nameElement) {
      return;
    }

    const company
      = findCompanyByName(registry, nameElement.textContent.trim())
      ?? resolveCompanyFromContainer(container, registry);

    applyCompanyHighlight(nameElement, company, company?.linkedinCode ?? "unknown");

  }

  function _applyJobsPage (): void {

    if (isAddCompanyModalOpen()) {
      return;
    }

    if (!isJobsPage()) {
      return;
    }

    const registry = getCachedRegistry();
    if (0 === Object.keys(registry).length) {
      return;
    }

    for (const card of findJobCards()) {
      _applyJobCard(card, registry);
    }

    if (!isJobsTrackerPage()) {
      _applyJobDetail(registry);
    }

  }

  async function _init (): Promise<void> {

    initRegistryListeners();
    await loadRegistry();
    _applyJobsPage();

    onRegistryChange(() => {
      return _applyJobsPage();
    });

    initPageScanner(_applyJobsPage);

  }

// module

_init().catch((error: unknown) => {
  console.error(error);
});
