import { normalizeCompany, type Company, type CompanyStatus } from "../../types/company";
import { formatIndicatorLabel, getIndicators } from "../../types/indicator";
import { sendMessage } from "./messaging";

export interface AddCompanyModalOptions {
  "linkedinCode": string;
  "name": string;
  "comment"?: string;
  "onSaved": (company: Company) => void;
}

let activeModal: HTMLDivElement | null = null;
let modalOpen = false;

export function isAddCompanyModalOpen (): boolean {
  return modalOpen;
}

function closeModal (): void {
  modalOpen = false;
  activeModal?.remove();
  activeModal = null;
}

function focusCommentInput (commentInput: HTMLTextAreaElement): void {
  commentInput.focus({ "preventScroll": true });
}

export function showAddCompanyModal (options: AddCompanyModalOptions): void {
  closeModal();
  modalOpen = true;

  const overlay = document.createElement("div");
  overlay.className = "li-tracker-modal-overlay";
  activeModal = overlay;

  const dialog = document.createElement("div");
  dialog.className = "li-tracker-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "li-tracker-modal-title");

  const title = document.createElement("h2");
  title.id = "li-tracker-modal-title";
  title.textContent = "Ajouter une société";

  const form = document.createElement("form");
  form.className = "li-tracker-modal-form";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Nom *";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.required = true;
  nameInput.readOnly = true;
  nameInput.value = options.name;
  nameLabel.append(nameInput);

  const codeLabel = document.createElement("label");
  codeLabel.textContent = "Code LinkedIn";
  const codeInput = document.createElement("input");
  codeInput.type = "text";
  codeInput.readOnly = true;
  codeInput.value = options.linkedinCode;
  codeLabel.append(codeInput);

  const indicatorsField = document.createElement("fieldset");
  indicatorsField.className = "li-tracker-modal-indicators";
  const indicatorsLegend = document.createElement("legend");
  indicatorsLegend.textContent = "Indicateurs";
  indicatorsField.append(indicatorsLegend);
  // Boutons à bascule plutôt que des cases à cocher natives : LinkedIn restyle les
  // <input type="checkbox"> et les rend non cliquables dans nos éléments injectés.
  const selectedIndicators: Set<CompanyStatus> = new Set();
  for (const indicator of getIndicators()) {
    const code = indicator.code as CompanyStatus;
    const option = document.createElement("button");
    option.type = "button";
    option.className = "li-tracker-modal-indicator";
    option.setAttribute("aria-pressed", "false");
    option.textContent = `${indicator.icon} ${formatIndicatorLabel(indicator)}`;
    option.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const pressed = !selectedIndicators.has(code);
      if (pressed) {
 selectedIndicators.add(code);
}
      else {
 selectedIndicators.delete(code);
}
      option.setAttribute("aria-pressed", String(pressed));
    });
    indicatorsField.append(option);
  }

  const commentLabel = document.createElement("label");
  commentLabel.textContent = "Commentaire (facultatif)";
  const commentInput = document.createElement("textarea");
  commentInput.rows = 3;
  commentInput.value = options.comment ?? "";
  commentInput.autofocus = true;
  commentLabel.append(commentInput);

  const errorEl = document.createElement("p");
  errorEl.className = "li-tracker-modal-error";
  errorEl.hidden = true;

  const actions = document.createElement("div");
  actions.className = "li-tracker-modal-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "li-tracker-modal-btn li-tracker-modal-btn--secondary";
  cancelBtn.textContent = "Annuler";

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "li-tracker-modal-btn";
  saveBtn.textContent = "Enregistrer";

  actions.append(cancelBtn, saveBtn);
  form.append(nameLabel, codeLabel, indicatorsField, commentLabel, errorEl, actions);
  dialog.append(title, form);
  overlay.append(dialog);

  function showError (message: string): void {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  cancelBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
 closeModal();
}
  });

  async function handleSubmit (event: Event): Promise<void> {
    event.preventDefault();
    errorEl.hidden = true;

    const company = normalizeCompany({
      "name": nameInput.value.trim(),
      "linkedinCode": options.linkedinCode,
      "indicators": [ ...selectedIndicators ],
      "comment": commentInput.value
    });

    if (!company.name) {
      showError("Le nom est obligatoire.");
      nameInput.focus();
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Enregistrement…";

    const response = await sendMessage({ "type": "ADD_COMPANY", company });
    saveBtn.disabled = false;
    saveBtn.textContent = "Enregistrer";

    if (!response.ok) {
      showError(response.error);
      return;
    }

    closeModal();
    options.onSaved(company);
  }

  form.addEventListener("submit", (event) => {
    handleSubmit(event).catch((error: unknown) => {
      console.error(error);
    });
  });

  document.body.append(overlay);

  // LinkedIn reprend le focus au tick suivant : on force plusieurs fois sur "Commentaire (facultatif)".
  focusCommentInput(commentInput);
  requestAnimationFrame(() => {
    focusCommentInput(commentInput);
    window.setTimeout(() => {
 return focusCommentInput(commentInput);
}, 50);
  });
}
