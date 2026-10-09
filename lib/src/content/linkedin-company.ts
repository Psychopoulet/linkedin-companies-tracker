// deps

  // locals
  import { initPageScanner } from "./shared/page-scanner";
  import {
    findCompanyTitleElement,
    getCompanyNameFromElement,
    getLinkedinCodeFromUrl,
    isCompanyPage
  } from "./shared/dom-utils";
  import { clearHighlights, createAddButton, applyCompanyHighlight } from "./shared/highlighter";
  import { showAddCompanyModal, isAddCompanyModalOpen } from "./shared/modal";
  import { getCachedRegistry, initRegistryListeners, loadRegistry, onRegistryChange } from "./shared/registry-client";

// types & interfaces

  // locals
  import type { Company } from "../types/company";

// private

  // attributes
  let _scanController = new AbortController();

  // methods

  function _resetScan (): void {

    _scanController.abort();
    _scanController = new AbortController();

    clearHighlights();

  }

  function _applyCompanyPage (): void {

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

    _resetScan();
    const { signal } = _scanController;
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
          return _applyCompanyPage();
        }
      });
    }, signal);

    titleElement.append(addButton);

  }

  async function _init (): Promise<void> {

    initRegistryListeners();
    await loadRegistry();
    _applyCompanyPage();

    onRegistryChange(() => {
      return _applyCompanyPage();
    });

    initPageScanner(_applyCompanyPage);

  }

// module

_init().catch((error: unknown) => {
  console.error(error);
});
