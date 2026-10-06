import { initPageScanner } from "./shared/page-scanner";
import {
  findCompanyTitleElement,
  getCompanyNameFromElement,
  getLinkedinCodeFromUrl,
  isCompanyPage
} from "./shared/dom-utils";
import { clearHighlights, createAddButton, applyCompanyHighlight } from "./shared/highlighter";
import { showAddCompanyModal, isAddCompanyModalOpen } from "./shared/modal";
import type { Company } from "../types/company";
import { getCachedRegistry, initRegistryListeners, loadRegistry, onRegistryChange } from "./shared/registry-client";

let scanController = new AbortController();

function resetScan (): void {
  scanController.abort();
  scanController = new AbortController();
  clearHighlights();
}

function applyCompanyPage (): void {
  if (isAddCompanyModalOpen()) {
 return;
}
  if (!isCompanyPage()) {
 return;
}

  const linkedinCode = getLinkedinCodeFromUrl();
  const titleElement = findCompanyTitleElement();
  if (null === linkedinCode || "" === linkedinCode || null === titleElement) {
    return;
  }

  resetScan();
  const { signal } = scanController;
  const company = getCachedRegistry()[linkedinCode] as Company | undefined;

  // Une société sans indicateur n'est pas stylée : on garde le bouton "+" pour en ajouter.
  if (undefined !== company && 0 < company.indicators.length) {
    applyCompanyHighlight(titleElement, company, linkedinCode);
    return;
  }

  if (null !== titleElement.querySelector(".li-tracker-add-btn")) {
 return;
}

  const companyName = getCompanyNameFromElement(titleElement);
  const addButton = createAddButton(() => {
    showAddCompanyModal({
      linkedinCode,
      "name": companyName,
      "comment": company?.comment,
      "onSaved": () => {
 return applyCompanyPage();
}
    });
  }, signal);

  titleElement.append(addButton);
}

async function init (): Promise<void> {
  initRegistryListeners();
  await loadRegistry();
  applyCompanyPage();

  onRegistryChange(() => {
 return applyCompanyPage();
});
  initPageScanner(applyCompanyPage);
}

init().catch((error: unknown) => {
  console.error(error);
});
