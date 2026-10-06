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
  wrapCompanyNamePrefix,
} from "./shared/job-dom-utils";
import { applyCompanyHighlight } from "./shared/highlighter";
import { isAddCompanyModalOpen } from "./shared/modal";
import { initPageScanner } from "./shared/page-scanner";
import { getCachedRegistry, initRegistrySync, loadRegistry, onRegistryChange } from "./shared/registry-client";
import type { Company, CompanyRegistry } from "../types/company";

function applyHighlightOnCompanyName(
  container: ParentNode,
  registry: CompanyRegistry,
  nameElement: HTMLElement,
  company?: Company
): void {
  const resolved =
    company ??
    resolveCompanyFromContainer(container, registry) ??
    undefined;

  applyCompanyHighlight(nameElement, resolved, resolved?.linkedinCode ?? "unknown");
}

function applyJobCard(card: HTMLElement, registry: CompanyRegistry): void {
  if (isJobsTrackerPage()) {
    const match = findCompanyInJobsTrackerCard(card, registry);
    if (!match) return;

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
    if (!nameElement) return;

    const company = findCompanyByName(registry, nameElement.textContent?.trim() ?? "");
    applyCompanyHighlight(nameElement, company, company?.linkedinCode ?? "unknown");
    return;
  }

  const nameElement = isJobsSearchResultsPage()
    ? findCompanyNameElementInListCard(card)
    : findCompanyNameElement(card);

  if (!nameElement) return;

  applyHighlightOnCompanyName(card, registry, nameElement);
}

function applyJobDetail(registry: CompanyRegistry): void {
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
  if (!container) return;

  const panelMatch = findCompanyInJobDetailPanel(container, registry);
  if (panelMatch) {
    applyCompanyHighlight(
      panelMatch.element,
      panelMatch.company,
      panelMatch.company.linkedinCode
    );
    return;
  }

  const nameElement =
    findCompanyNameElement(container) ?? findCompanyNameElementInListCard(container);
  if (!nameElement) return;

  const company =
    findCompanyByName(registry, nameElement.textContent?.trim() ?? "") ??
    resolveCompanyFromContainer(container, registry);

  applyCompanyHighlight(nameElement, company, company?.linkedinCode ?? "unknown");
}

function applyJobsPage(): void {
  if (isAddCompanyModalOpen()) return;
  if (!isJobsPage()) return;

  const registry = getCachedRegistry();
  if (Object.keys(registry).length === 0) return;

  for (const card of findJobCards()) {
    applyJobCard(card, registry);
  }

  if (!isJobsTrackerPage()) {
    applyJobDetail(registry);
  }
}

async function init(): Promise<void> {
  initRegistrySync();
  await loadRegistry();
  applyJobsPage();

  onRegistryChange(() => applyJobsPage());
  initPageScanner(applyJobsPage);
}

void init();
