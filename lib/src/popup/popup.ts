import type { Company, CompanyRegistry, CompanyStatus } from "../types/company";
import { companyLinkedinUrl, formatCompanyPopupDetail, normalizeCompany, normalizeLinkedinCode, normalizeRegistry, companySortRank } from "../types/company";
import { formatIndicatorLabel, getIndicators, getIndicatorsColor, sortIndicatorsByCriticityDesc } from "../types/indicator";
import type { Message, MessageResponse } from "../messages";
import { REGISTRY_STORAGE_KEY } from "../storage/constants";
import { parseCompaniesJson, serializeCompanies } from "../storage/import-export";

async function sendMessage(message: Message): Promise<MessageResponse> {
  return chrome.runtime.sendMessage(message);
}

const searchInput = document.getElementById("search") as HTMLInputElement;
const statusFilter = document.getElementById("status-filter") as HTMLSelectElement;
const companyForm = document.getElementById("company-form") as HTMLFormElement;
const formTitle = document.getElementById("form-title") as HTMLHeadingElement;
const editModeInput = document.getElementById("edit-mode") as HTMLInputElement;
const nameInput = document.getElementById("name") as HTMLInputElement;
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

let registry: CompanyRegistry = {};

function hideError(): void {
  formError.hidden = true;
  formError.textContent = "";
}

function showError(message: string): void {
  formError.hidden = false;
  formError.textContent = message;
}

function hideIoMessage(): void {
  ioMessage.hidden = true;
  ioMessage.textContent = "";
  ioMessage.classList.remove("error", "success");
}

function showIoMessage(message: string, type: "error" | "success"): void {
  ioMessage.hidden = false;
  ioMessage.textContent = message;
  ioMessage.classList.remove("error", "success");
  ioMessage.classList.add(type);
}

function fillStatusSelects(): void {
  const indicators = getIndicators();

  statusFilter.replaceChildren();
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Tous les indicateurs";
  statusFilter.append(allOption);

  indicatorsField.replaceChildren();
  const legend = document.createElement("legend");
  legend.textContent = "Indicateurs";
  indicatorsField.append(legend);
  indicatorInputs.length = 0;
  for (const indicator of indicators) {
    const filterOption = document.createElement("option");
    filterOption.value = indicator.code;
    filterOption.textContent = formatIndicatorLabel(indicator);
    statusFilter.append(filterOption);

    const option = document.createElement("label");
    option.className = "indicator-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = indicator.code;
    indicatorInputs.push(checkbox);
    option.append(checkbox, ` ${indicator.icon} ${formatIndicatorLabel(indicator)}`);
    indicatorsField.append(option);
  }
}

function getFilteredCompanies(): Company[] {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value as CompanyStatus | "";

  return Object.values(registry)
    .filter((company) => {
      const matchesStatus = !status || company.indicators.includes(status);
      const matchesQuery =
        !query ||
        company.name.toLowerCase().includes(query) ||
        company.linkedinCode.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    })
    .sort((a, b) => {
      const statusDiff = companySortRank(a) - companySortRank(b);
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name, "fr");
    });
}

function renderList(): void {
  const companies = getFilteredCompanies();
  companyList.innerHTML = "";
  countEl.textContent = String(Object.keys(registry).length);
  emptyState.hidden = companies.length > 0;

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
    label.textContent = company.name;
    label.addEventListener("click", (event) => {
      event.preventDefault();
      void chrome.tabs.create({ url: companyUrl });
    });

    if (indicators.length > 0) {
      if (color) name.style.color = color;
      const icon = document.createElement("span");
      icon.className = "company-icon";
      icon.textContent = indicators.map((indicator) => indicator.icon).join("");
      name.append(icon, label);
    } else {
      name.append(label);
    }

    const code = document.createElement("div");
    code.className = "company-code";
    code.textContent = company.linkedinCode;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = indicators.map((indicator) => indicator.code).join(", ");
    if (color) {
      badge.style.color = color;
    }

    info.append(name, code);
    header.append(info, badge);

    const detail = document.createElement("div");
    detail.className = "company-comment";
    detail.textContent = formatCompanyPopupDetail(company);

    const actions = document.createElement("div");
    actions.className = "company-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Modifier";
    editBtn.addEventListener("click", () => startEdit(company));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Supprimer";
    deleteBtn.addEventListener("click", () => void deleteCompany(company.linkedinCode));

    actions.append(editBtn, deleteBtn);
    li.append(header, detail, actions);
    companyList.append(li);
  }
}

function resetForm(): void {
  editModeInput.value = "add";
  formTitle.textContent = "Ajouter une société";
  submitBtn.textContent = "Ajouter";
  linkedinCodeInput.disabled = false;
  cancelEditBtn.hidden = true;
  companyForm.reset();
  hideError();
}

function startEdit(company: Company): void {
  editModeInput.value = "edit";
  formTitle.textContent = "Modifier une société";
  submitBtn.textContent = "Enregistrer";
  nameInput.value = company.name;
  linkedinCodeInput.value = company.linkedinCode;
  linkedinCodeInput.disabled = true;
  for (const input of indicatorInputs) {
    input.checked = company.indicators.includes(input.value as CompanyStatus);
  }
  commentInput.value = company.comment ?? "";
  cancelEditBtn.hidden = false;
  hideError();
  nameInput.focus();
}

async function loadRegistry(): Promise<void> {
  const response = await sendMessage({ type: "GET_REGISTRY" });
  if (!response.ok) {
    showError(response.error);
    return;
  }
  registry = response.registry;
  renderList();
}

async function deleteCompany(linkedinCode: string): Promise<void> {
  if (!confirm(`Supprimer ${linkedinCode} ?`)) return;

  const response = await sendMessage({ type: "DELETE_COMPANY", linkedinCode });
  if (!response.ok) {
    showError(response.error);
    return;
  }
  registry = response.registry;
  if (editModeInput.value === "edit" && linkedinCodeInput.value === linkedinCode) {
    resetForm();
  }
  renderList();
}

companyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError();

  const company = normalizeCompany({
    name: nameInput.value.trim(),
    linkedinCode: normalizeLinkedinCode(linkedinCodeInput.value),
    indicators: indicatorInputs
      .filter((input) => input.checked)
      .map((input) => input.value as CompanyStatus),
    comment: commentInput.value,
  });

  if (!company.name) {
    showError("Le nom est obligatoire.");
    return;
  }

  const isEdit = editModeInput.value === "edit";
  const response = await sendMessage(
    isEdit ? { type: "UPDATE_COMPANY", company } : { type: "ADD_COMPANY", company }
  );

  if (!response.ok) {
    showError(response.error);
    return;
  }

  registry = response.registry;
  resetForm();
  renderList();
});

function exportFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `linkedin-companies-${date}.json`;
}

function exportRegistry(): void {
  hideIoMessage();
  const blob = new Blob([serializeCompanies(registry)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFilename();
  link.click();
  URL.revokeObjectURL(url);
  const count = Object.keys(registry).length;
  showIoMessage(
    count === 0
      ? "Liste vide exportée."
      : `${count} société${count > 1 ? "s" : ""} exportée${count > 1 ? "s" : ""}.`,
    "success"
  );
}

async function importFromText(text: string): Promise<void> {
  hideIoMessage();

  let companies: Company[];
  try {
    companies = parseCompaniesJson(text);
  } catch (error) {
    showIoMessage(error instanceof Error ? error.message : "Fichier JSON invalide.", "error");
    return;
  }

  const currentCount = Object.keys(registry).length;
  const importedCount = companies.length;
  const confirmMessage =
    currentCount === 0
      ? `Importer ${importedCount} société${importedCount > 1 ? "s" : ""} ?`
      : `Remplacer la liste actuelle (${currentCount}) par ${importedCount} société${importedCount > 1 ? "s" : ""} ?`;

  if (!confirm(confirmMessage)) return;

  const response = await sendMessage({ type: "IMPORT_REGISTRY", companies });
  if (!response.ok) {
    showIoMessage(response.error, "error");
    return;
  }

  registry = response.registry;
  resetForm();
  renderList();
  showIoMessage(
    `${importedCount} société${importedCount > 1 ? "s" : ""} importée${importedCount > 1 ? "s" : ""}.`,
    "success"
  );
}

async function importFromFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
    showIoMessage("Choisissez un fichier JSON.", "error");
    return;
  }
  await importFromText(await file.text());
}

cancelEditBtn.addEventListener("click", resetForm);
searchInput.addEventListener("input", renderList);
statusFilter.addEventListener("change", renderList);

exportBtn.addEventListener("click", exportRegistry);
importBtn.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", () => {
  const file = importFileInput.files?.[0];
  importFileInput.value = "";
  if (file) void importFromFile(file);
});

document.addEventListener("dragover", (event) => {
  event.preventDefault();
  ioSection.classList.add("is-dragover");
});
document.addEventListener("dragleave", (event) => {
  if (event.relatedTarget === null) {
    ioSection.classList.remove("is-dragover");
  }
});
document.addEventListener("drop", (event) => {
  event.preventDefault();
  ioSection.classList.remove("is-dragover");
  const file = event.dataTransfer?.files[0];
  if (file) void importFromFile(file);
});

fillStatusSelects();
void loadRegistry();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[REGISTRY_STORAGE_KEY]) return;

  const next = changes[REGISTRY_STORAGE_KEY].newValue;
  registry =
    next && typeof next === "object" ? normalizeRegistry(next as CompanyRegistry).registry : {};
  if (editModeInput.value === "edit" && !registry[linkedinCodeInput.value]) {
    resetForm();
  }
  renderList();
});
