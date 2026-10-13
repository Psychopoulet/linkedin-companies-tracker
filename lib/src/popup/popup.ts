// deps

  // locals
  import { companyLinkedinUrl, formatCompanyPopupDetail, normalizeCompany, normalizeLinkedinCode, normalizeRegistry, companySortRank } from "../types/company";
  import { formatIndicatorLabel, getIndicatorColor, getIndicators, getIndicatorsColor, sortIndicatorsByCriticityDesc } from "../types/indicator";
  import { REGISTRY_STORAGE_KEY } from "../storage/constants";
  import { parseCompaniesJson, serializeCompanies } from "../storage/import-export";

// types & interfaces

  // locals
  import type { Company, CompanyRegistry, CompanyStatus } from "../types/company";
  import type { Indicator } from "../types/indicator";
  import type { Message, MessageResponse } from "../messages";

// consts

  const searchInput = document.getElementById("search") as HTMLInputElement;
  const statusFilter = document.getElementById("status-filter") as HTMLSelectElement;
  const companyForm = document.getElementById("company-form") as HTMLFormElement;
  const formTitle = document.getElementById("form-title") as HTMLHeadingElement;
  const editModeInput = document.getElementById("edit-mode") as HTMLInputElement;
  const nameRows = document.getElementById("name-rows") as HTMLDivElement;
  const addNameBtn = document.getElementById("add-name") as HTMLButtonElement;
  const linkedinCodeInput = document.getElementById("linkedin-code") as HTMLInputElement;
  const indicatorsField = document.getElementById("indicators") as HTMLFieldSetElement;
  const indicatorInputs: HTMLInputElement[] = [];
  const commentInput = document.getElementById("comment") as HTMLTextAreaElement;
  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement;
  const cancelEditBtn = document.getElementById("cancel-edit") as HTMLButtonElement;
  const formError = document.getElementById("form-error") as HTMLParagraphElement;
  const companyList = document.getElementById("company-list") as HTMLUListElement;
  const emptyState = document.getElementById("empty-state") as HTMLParagraphElement;
  const countEl = document.getElementById("count") as HTMLSpanElement;
  const ioSection = document.getElementById("io-section") as HTMLElement;
  const exportBtn = document.getElementById("export-btn") as HTMLButtonElement;
  const importBtn = document.getElementById("import-btn") as HTMLButtonElement;
  const importFileInput = document.getElementById("import-file") as HTMLInputElement;
  const ioMessage = document.getElementById("io-message") as HTMLParagraphElement;

// private

  // attributes
  let _registry: CompanyRegistry = {};

  // methods

  async function _sendMessage (message: Message): Promise<MessageResponse> {
    return chrome.runtime.sendMessage(message);
  }

  function _nameInputs (): HTMLInputElement[] {
    return Array.from(nameRows.querySelectorAll<HTMLInputElement>(".name-input"));
  }

  function _syncNameRemoveButtons (): void {
    const rows = Array.from(nameRows.querySelectorAll<HTMLElement>(".name-row"));
    const hideRemove = 1 >= rows.length;
    for (const row of rows) {
      const button = row.querySelector<HTMLButtonElement>(".name-remove");
      if (null !== button) {
        button.hidden = hideRemove;
      }
    }
  }

  function _createNameRow (value: string): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "name-row";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "name-input";
    input.placeholder = "Ex. Capgemini";
    input.value = value;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary name-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      row.remove();
      _syncNameRemoveButtons();
    });

    row.append(input, remove);
    return row;
  }

  function _setNameRows (names: string[]): void {
    const values = 0 < names.length ? names : [ "" ];
    nameRows.replaceChildren();
    for (const value of values) {
      nameRows.append(_createNameRow(value));
    }
    _syncNameRemoveButtons();
  }

  function _readNames (): string[] {
    return _nameInputs().map((input) => {
      return input.value.trim();
    });
  }

  function _hideError (): void {
    formError.hidden = true;
    formError.textContent = "";
  }

  function _showError (message: string): void {
    formError.hidden = false;
    formError.textContent = message;
  }

  function _hideIoMessage (): void {
    ioMessage.hidden = true;
    ioMessage.textContent = "";
    ioMessage.classList.remove("error", "success");
  }

  function _showIoMessage (message: string, type: "error" | "success"): void {
    ioMessage.hidden = false;
    ioMessage.textContent = message;
    ioMessage.classList.remove("error", "success");
    ioMessage.classList.add(type);
  }

  function _applyIndicatorColor (element: HTMLElement, indicator: Indicator): void {
    const color = getIndicatorColor(indicator);
    if (undefined !== color) {
      element.style.color = color;
    }
  }

  function _fillStatusSelects (): void {
    const indicators = getIndicators();

    statusFilter.replaceChildren();
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All indicators";
    statusFilter.append(allOption);

    indicatorsField.replaceChildren();
    const legend = document.createElement("legend");
    legend.textContent = "Indicators";
    indicatorsField.append(legend);
    indicatorInputs.length = 0;
    for (const indicator of indicators) {
      const filterOption = document.createElement("option");
      filterOption.value = indicator.code;
      filterOption.textContent = formatIndicatorLabel(indicator);
      _applyIndicatorColor(filterOption, indicator);
      statusFilter.append(filterOption);

      const option = document.createElement("label");
      option.className = "indicator-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = indicator.code;
      indicatorInputs.push(checkbox);
      const optionLabel = document.createElement("span");
      optionLabel.textContent = `${indicator.icon} ${formatIndicatorLabel(indicator)}`;
      _applyIndicatorColor(optionLabel, indicator);
      option.append(checkbox, optionLabel);
      indicatorsField.append(option);
    }
  }

  function _insertExtraNames (info: HTMLElement, company: Company, before: HTMLElement): void {
    const aliases = company.names.slice(1);
    if (0 === aliases.length) {
      return;
    }
    const extra = document.createElement("div");
    extra.className = "company-aliases";
    extra.textContent = aliases.join(", ");
    info.insertBefore(extra, before);
  }

  function _getFilteredCompanies (): Company[] {
    const query = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value as CompanyStatus | "";

    return Object.values(_registry)
      .filter((company) => {
        const matchesStatus = !status || company.indicators.includes(status);
        const matchesQuery
          = !query
          || company.names.some((stored) => {
            return stored.toLowerCase().includes(query);
          })
          || company.linkedinCode.toLowerCase().includes(query);
        return matchesStatus && matchesQuery;
      })
      .sort((a, b) => {
        const statusDiff = companySortRank(a) - companySortRank(b);
        if (0 !== statusDiff) {
          return statusDiff;
        }
        return (a.names[0] ?? "").localeCompare(b.names[0] ?? "", "fr");
      });
  }

  function _renderList (): void {
    const companies = _getFilteredCompanies();
    companyList.innerHTML = "";
    countEl.textContent = String(Object.keys(_registry).length);
    emptyState.hidden = 0 < companies.length;

    for (const company of companies) {
      const li = document.createElement("li");
      li.className = "company-item";

      const header = document.createElement("div");
      header.className = "company-header";

      const info = document.createElement("div");
      const indicators = sortIndicatorsByCriticityDesc(company.indicators);
      const color = getIndicatorsColor(company.indicators);

      const name = document.createElement("div");
      name.className = "company-name";

      const label = document.createElement("a");
      label.className = "company-name-link";
      const companyUrl = companyLinkedinUrl(company.linkedinCode);
      label.href = companyUrl;
      label.textContent = company.names[0] ?? "";
      label.addEventListener("click", (event) => {
        event.preventDefault();
        chrome.tabs.create({ "url": companyUrl }).catch(_reportError);
      });

      if (undefined !== color) {
        label.style.color = color;
      }

      if (0 < indicators.length) {
        const icon = document.createElement("span");
        icon.className = "company-icon";
        for (const indicator of indicators) {
          const glyph = document.createElement("span");
          glyph.textContent = indicator.icon;
          _applyIndicatorColor(glyph, indicator);
          icon.append(glyph);
        }
        name.append(icon, label);
      }
      else {
        name.append(label);
      }

      const code = document.createElement("div");
      code.className = "company-code";
      code.textContent = company.linkedinCode;

      const badge = document.createElement("span");
      badge.className = "badge";
      for (const [ index, indicator ] of indicators.entries()) {
        if (0 < index) {
          badge.append(", ");
        }
        const badgeCode = document.createElement("span");
        badgeCode.textContent = indicator.code;
        _applyIndicatorColor(badgeCode, indicator);
        badge.append(badgeCode);
      }

      info.append(name, code);
      _insertExtraNames(info, company, code);
      header.append(info, badge);

      const detail = document.createElement("div");
      detail.className = "company-comment";
      detail.textContent = formatCompanyPopupDetail(company);

      const actions = document.createElement("div");
      actions.className = "company-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        return _startEdit(company);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        _deleteCompany(company.linkedinCode).catch(_reportError);
      });

      actions.append(editBtn, deleteBtn);
      li.append(header, detail, actions);
      companyList.append(li);
    }
  }

  function _reportError (error: unknown): void {
    console.error(error);
  }

  function _resetForm (): void {
    editModeInput.value = "add";
    formTitle.textContent = "Add a company";
    submitBtn.textContent = "Add";
    linkedinCodeInput.disabled = false;
    cancelEditBtn.hidden = true;
    companyForm.reset();
    _setNameRows([ "" ]);
    _hideError();
  }

  function _startEdit (company: Company): void {
    editModeInput.value = "edit";
    formTitle.textContent = "Edit company";
    submitBtn.textContent = "Save";
    _setNameRows(company.names);
    linkedinCodeInput.value = company.linkedinCode;
    linkedinCodeInput.disabled = true;
    for (const input of indicatorInputs) {
      input.checked = company.indicators.includes(input.value as CompanyStatus);
    }
    commentInput.value = company.comment ?? "";
    cancelEditBtn.hidden = false;
    _hideError();
    _nameInputs()[0]?.focus();
  }

  async function _loadRegistry (): Promise<void> {
    const response = await _sendMessage({ "type": "GET_REGISTRY" });
    if (!response.ok) {
      _showError(response.error);
      return;
    }
    _registry = response.registry;
    _renderList();
  }

  async function _deleteCompany (linkedinCode: string): Promise<void> {
    // eslint-disable-next-line no-alert
    if (!confirm(`Delete ${linkedinCode}?`)) {
      return;
    }

    const response = await _sendMessage({ "type": "DELETE_COMPANY", linkedinCode });
    if (!response.ok) {
      _showError(response.error);
      return;
    }
    _registry = response.registry;
    if ("edit" === editModeInput.value && linkedinCodeInput.value === linkedinCode) {
      _resetForm();
    }
    _renderList();
  }

  async function _handleCompanySubmit (event: Event): Promise<void> {
    event.preventDefault();
    _hideError();

    const company = normalizeCompany({
      "names": _readNames(),
      "linkedinCode": normalizeLinkedinCode(linkedinCodeInput.value),
      "indicators": indicatorInputs
        .filter((input) => {
          return input.checked;
        })
        .map((input) => {
          return input.value as CompanyStatus;
        }),
      "comment": commentInput.value
    });

    if (0 === company.names.length) {
      _showError("Name is required.");
      return;
    }

    const isEdit = "edit" === editModeInput.value;
    const response = await _sendMessage(
      isEdit ? { "type": "UPDATE_COMPANY", company } : { "type": "ADD_COMPANY", company }
    );

    if (!response.ok) {
      _showError(response.error);
      return;
    }

    _registry = response.registry;
    _resetForm();
    _renderList();
  }

  function _exportFilename (): string {
    const date = new Date().toISOString().slice(0, 10);
    return `linkedin-companies-${date}.json`;
  }

  function _exportRegistry (): void {
    _hideIoMessage();
    const blob = new Blob([ serializeCompanies(_registry) ], { "type": "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = _exportFilename();
    link.click();
    URL.revokeObjectURL(url);
    const count = Object.keys(_registry).length;
    _showIoMessage(
      0 === count
        ? "Empty list exported."
        : `${count} ${1 === count ? "company" : "companies"} exported.`,
      "success"
    );
  }

  function _parseCompaniesOrReport (text: string): Company[] | null {
    try {
      return parseCompaniesJson(text);
    }
    catch (error) {
      _showIoMessage(error instanceof Error ? error.message : "Invalid JSON file.", "error");
      return null;
    }
  }

  function _replaceLocalRegistry (next: CompanyRegistry): void {
    _registry = next;
  }

  async function _importFromText (text: string): Promise<void> {
    _hideIoMessage();

    const companies = _parseCompaniesOrReport(text);
    if (null === companies) {
      return;
    }

    const currentCount = Object.keys(_registry).length;
    const importedCount = companies.length;
    const importedLabel = `${importedCount} ${1 === importedCount ? "company" : "companies"}`;
    const confirmMessage
      = 0 === currentCount
        ? `Import ${importedLabel}?`
        : `Replace the current list (${currentCount}) with ${importedLabel}?`;

    // eslint-disable-next-line no-alert
    if (!confirm(confirmMessage)) {
      return;
    }

    const response = await _sendMessage({ "type": "IMPORT_REGISTRY", companies });
    if (!response.ok) {
      _showIoMessage(response.error, "error");
      return;
    }

    _replaceLocalRegistry(response.registry);
    _resetForm();
    _renderList();
    _showIoMessage(
      `${importedCount} ${1 === importedCount ? "company" : "companies"} imported.`,
      "success"
    );
  }

  async function _importFromFile (file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith(".json") && "application/json" !== file.type) {
      _showIoMessage("Choose a JSON file.", "error");
      return;
    }
    await _importFromText(await file.text());
  }

// module

companyForm.addEventListener("submit", (event) => {
  _handleCompanySubmit(event).catch(_reportError);
});

addNameBtn.addEventListener("click", () => {
  const row = _createNameRow("");
  nameRows.append(row);
  _syncNameRemoveButtons();
  row.querySelector<HTMLInputElement>(".name-input")?.focus();
});

cancelEditBtn.addEventListener("click", _resetForm);

searchInput.addEventListener("input", _renderList);

statusFilter.addEventListener("change", _renderList);

exportBtn.addEventListener("click", _exportRegistry);

importBtn.addEventListener("click", () => {
  return importFileInput.click();
});

importFileInput.addEventListener("change", () => {
  const file = importFileInput.files?.[0];
  importFileInput.value = "";
  if (file) {
    _importFromFile(file).catch(_reportError);
  }
});

document.addEventListener("dragover", (event) => {
  event.preventDefault();
  ioSection.classList.add("is-dragover");
});

document.addEventListener("dragleave", (event) => {
  if (null === event.relatedTarget) {
    ioSection.classList.remove("is-dragover");
  }
});

document.addEventListener("drop", (event) => {
  event.preventDefault();
  ioSection.classList.remove("is-dragover");
  const file = event.dataTransfer?.files[0];
  if (file) {
    _importFromFile(file).catch(_reportError);
  }
});

_setNameRows([ "" ]);
_fillStatusSelects();

_loadRegistry().catch(_reportError);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if ("local" !== areaName || !(REGISTRY_STORAGE_KEY in changes)) {
    return;
  }

  const next: unknown = changes[REGISTRY_STORAGE_KEY].newValue;
  _registry
    = "object" === typeof next && null !== next ? normalizeRegistry(next as CompanyRegistry).registry : {};
  if ("edit" === editModeInput.value && !Object.hasOwn(_registry, linkedinCodeInput.value)) {
    _resetForm();
  }
  _renderList();
});
