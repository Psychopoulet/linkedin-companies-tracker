// deps

  // locals
  import { formatCompanyPopupDetail } from "../../types/company";
  import { getIndicatorsColor, sortIndicatorsByCriticityDesc } from "../../types/indicator";

// types & interfaces

  // locals
  import type { Company } from "../../types/company";

// consts

  const HIGHLIGHT_CLASS = "li-tracker--highlighted";
  const ICON_ATTR = "data-li-tracker-icon";
  const elementControllers: WeakMap<HTMLElement, AbortController> = new WeakMap();

// private

  // attributes
  let _tooltipEl: HTMLDivElement | null = null;

  // methods

  function _ensureTooltip (): HTMLDivElement {

    if (!_tooltipEl) {
      _tooltipEl = document.createElement("div");
      _tooltipEl.className = "li-tracker-tooltip";
      _tooltipEl.hidden = true;
      document.body.append(_tooltipEl);
    }

    return _tooltipEl;

  }

  function _formatTooltipContent (company: Company): string {
    return formatCompanyPopupDetail(company);
  }

  function _syncStatusIcon (element: HTMLElement, icon: string): void {

    const existing = element.querySelector<HTMLElement>(`:scope > [${ICON_ATTR}]`);
    if (!icon) {
      existing?.remove();
      return;
    }

    const iconEl = existing ?? element.ownerDocument.createElement("span");
    iconEl.setAttribute(ICON_ATTR, "true");
    iconEl.className = "li-tracker-icon";
    iconEl.setAttribute("aria-hidden", "true");
    iconEl.textContent = icon;

    if (!existing) {
      element.insertBefore(iconEl, element.firstChild);
    }

  }

  function _removeStatusIcon (element: HTMLElement): void {

    element.querySelectorAll(`[${ICON_ATTR}]`).forEach((node) => {
      node.remove();
    });

  }

  function _positionTooltip (target: HTMLElement, tooltip: HTMLDivElement): void {

    const rect = target.getBoundingClientRect();
    const halfWidth = rect.width / 2;
    tooltip.style.left = `${rect.left + halfWidth}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;

  }

// module

export function clearElementHighlight (element: HTMLElement): void {

  element.removeAttribute("data-li-tracker-highlighted");
  element.removeAttribute("data-li-tracker-applied");
  element.classList.remove(HIGHLIGHT_CLASS);
  element.style.removeProperty("--li-tracker-color");

  _removeStatusIcon(element);

}

export function applyCompanyHighlight (
  element: HTMLElement,
  company: Company | undefined,
  linkedinCode: string
): void {

  const targetKey = company ? `${linkedinCode}:${company.indicators.join(",")}:icon` : "none";
  if (element.getAttribute("data-li-tracker-applied") === targetKey) {
    return;
  }

  elementControllers.get(element)?.abort();
  clearElementHighlight(element);

  if (!company) {
    elementControllers.delete(element);
    return;
  }

  const controller = new AbortController();
  elementControllers.set(element, controller);
  highlightCompany(element, company, controller.signal);
  element.setAttribute("data-li-tracker-applied", targetKey);

}

export function clearHighlights (root: ParentNode = document): void {

  root.querySelectorAll<HTMLElement>("[data-li-tracker-highlighted], [data-li-tracker-applied]").forEach((element) => {
    elementControllers.get(element)?.abort();
    elementControllers.delete(element);
    clearElementHighlight(element);
  });

  root.querySelectorAll(".li-tracker-add-btn").forEach((button) => {
    return button.remove();
  });

}

export function highlightCompany (
  element: HTMLElement,
  company: Company,
  signal: AbortSignal
): void {

  element.setAttribute("data-li-tracker-highlighted", company.linkedinCode);

  const indicators = sortIndicatorsByCriticityDesc(company.indicators);
  element.classList.add(HIGHLIGHT_CLASS);

  const color = getIndicatorsColor(company.indicators);
  if (undefined !== color) {
    element.style.setProperty("--li-tracker-color", color);
  }

  _syncStatusIcon(element, indicators.map((indicator) => {
    return indicator.icon;
  }).join(""));

  const tooltip = _ensureTooltip();

  function showTooltip (): void {
    tooltip.textContent = _formatTooltipContent(company);
    tooltip.hidden = false;
    _positionTooltip(element, tooltip);
  }

  function hideTooltip (): void {
    tooltip.hidden = true;
  }

  function reposition (): void {

    if (false === tooltip.hidden) {
      _positionTooltip(element, tooltip);
    }

  }

  element.addEventListener("mouseenter", showTooltip, { signal });
  element.addEventListener("mouseleave", hideTooltip, { signal });
  element.addEventListener("focus", showTooltip, { signal });
  element.addEventListener("blur", hideTooltip, { signal });
  window.addEventListener("scroll", reposition, { signal, "capture": true });
  window.addEventListener("resize", reposition, { signal });

}

export function createAddButton (
  onClick: () => void,
  signal: AbortSignal
): HTMLButtonElement {

  const button = document.createElement("button");
  button.type = "button";
  button.className = "li-tracker-add-btn";
  button.title = "Add to the list";
  button.setAttribute("aria-label", "Add this company to the list");
  button.textContent = "+";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  }, { signal });

  return button;

}
