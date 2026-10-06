import { initPageScanner } from "./shared/page-scanner";
import {
  findCompanyTitleElement,
  getCompanyNameFromElement,
  getLinkedinCodeFromUrl,
  isCompanyPage,
} from "./shared/dom-utils";
import { clearHighlights, createAddButton, applyCompanyHighlight } from "./shared/highlighter";
import { showAddCompanyModal, isAddCompanyModalOpen } from "./shared/modal";
import { getCachedRegistry, initRegistrySync, loadRegistry, onRegistryChange } from "./shared/registry-client";

let scanController = new AbortController();

function resetScan(): void {
  scanController.abort();
  scanController = new AbortController();
  clearHighlights();
}

function applyCompanyPage(): void {
  if (isAddCompanyModalOpen()) return;
  if (!isCompanyPage()) return;

  const linkedinCode = getLinkedinCodeFromUrl();
  const titleElement = findCompanyTitleElement();
  if (!linkedinCode || !titleElement) return;

  resetScan();
  const signal = scanController.signal;
  const company = getCachedRegistry()[linkedinCode];

  // Une société sans indicateur n'est pas stylée : on garde le bouton "+" pour en ajouter.
  if (company && company.indicators.length > 0) {
    applyCompanyHighlight(titleElement, company, linkedinCode);
    return;
  }

  if (titleElement.querySelector(".li-tracker-add-btn")) return;

  const companyName = getCompanyNameFromElement(titleElement);
  const addButton = createAddButton(() => {
    showAddCompanyModal({
      linkedinCode,
      name: companyName,
      comment: company?.comment,
      onSaved: () => applyCompanyPage(),
    });
  }, signal);

  titleElement.append(addButton);
}

async function init(): Promise<void> {
  initRegistrySync();
  await loadRegistry();
  applyCompanyPage();

  onRegistryChange(() => applyCompanyPage());
  initPageScanner(applyCompanyPage);
}

void init();
