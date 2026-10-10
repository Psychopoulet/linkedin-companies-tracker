// deps

  // locals
  import {
    getIndicatorByCode,
    getIndicators
  } from "./indicator";

// types & interfaces

  // locals
  import type { IndicatorCode } from "./indicator";

  export type CompanyStatus = IndicatorCode;

  export interface Company {
    "linkedinCode": string;
    "name": string;
    "indicators": CompanyStatus[];
    "comment"?: string;
  }

  type CompanyInput = Partial<Company> & { "reason"?: string; "status"?: unknown };

  export type CompanyRegistry = Record<string, Company>;

// consts

  export const COMPANY_STATUSES: CompanyStatus[] = getIndicators().map(
    (indicator) => {
      return indicator.code as CompanyStatus;
    }
  );

  export const STATUS_SORT_ORDER = Object.fromEntries(
    COMPANY_STATUSES.map((code, index) => {
      return [ code, index ];
    })
  ) as Partial<Record<CompanyStatus, number>>;

  const LEGACY_STATUS_MAP: Partial<Record<string, CompanyStatus>> = {
    "banni": "BANNED",
    "esn": "IT_SERVICES_COMPANY",
    "suspect": "SUSPECT",
    "désiré": "WANTED",
    "desire": "WANTED"
  };

// private

  // methods
  function _readCompanyComment (company: CompanyInput): string | undefined {
    const value = company.comment ?? company.reason;
    const trimmed = "string" === typeof value ? value.trim() : "";
    return trimmed || undefined;
  }

// module

export function normalizeLinkedinCode (code: string): string {
  return code.trim().toLowerCase().replace(/\/+$/, "");
}

export function companyLinkedinUrl (linkedinCode: string): string {
  return `https://www.linkedin.com/company/${encodeURIComponent(normalizeLinkedinCode(linkedinCode))}/`;
}

export function normalizeCompanyStatus (status: unknown): CompanyStatus | null {
  if ("string" !== typeof status) {
    return null;
  }
  const trimmed = status.trim();
  if (!trimmed) {
    return null;
  }

  const indicator
    = getIndicatorByCode(trimmed) ?? getIndicatorByCode(trimmed.toUpperCase());
  if (indicator) {
    return indicator.code as CompanyStatus;
  }

  return LEGACY_STATUS_MAP[trimmed] ?? LEGACY_STATUS_MAP[trimmed.toLowerCase()] ?? null;
}

export function normalizeCompanyIndicators (indicators: unknown): CompanyStatus[] {
  if (!Array.isArray(indicators)) {
    return [];
  }
  const result: CompanyStatus[] = [];
  for (const value of indicators) {
    const code = normalizeCompanyStatus(value);
    if (code && !result.includes(code)) {
      result.push(code);
    }
  }
  return result;
}

export function readCompanyIndicators (company: CompanyInput): CompanyStatus[] {
  if (Array.isArray(company.indicators)) {
    return normalizeCompanyIndicators(company.indicators);
  }
  const legacy = normalizeCompanyStatus(company.status);
  return legacy ? [ legacy ] : [];
}

export function companySortRank (company: Pick<Company, "indicators">): number {
  if (0 === company.indicators.length) {
    return 99;
  }
  return Math.max(...company.indicators.map((code) => {
    return STATUS_SORT_ORDER[code] ?? 0;
  }));
}

export function normalizeCompany (company: CompanyInput & Pick<Company, "linkedinCode" | "name">): Company {
  const indicators = readCompanyIndicators(company);
  const comment = _readCompanyComment(company);
  const next: Company = {
    "linkedinCode": normalizeLinkedinCode(company.linkedinCode),
    "name": company.name.trim(),
    indicators
  };
  if (undefined !== comment) {
    next.comment = comment;
  }
  return next;
}

export function normalizeRegistry (registry: CompanyRegistry): {
  "registry": CompanyRegistry;
  "changed": boolean;
} {
  let changed = false;
  const next: CompanyRegistry = {};
  for (const [ key, company ] of Object.entries(registry)) {
    const normalized = normalizeCompany(company);
    const raw = company as CompanyInput;
    if (
      "status" in raw
      || JSON.stringify(normalized.indicators) !== JSON.stringify(company.indicators)
      || normalized.linkedinCode !== company.linkedinCode
      || _readCompanyComment(raw) !== normalized.comment
      || "reason" in raw
    ) {
      changed = true;
    }
    next[key] = normalized;
  }
  return { "registry": next, changed };
}

export function formatCompanyPopupDetail (company: Company): string {
  const description = company.indicators
    .map((code) => {
      const indicator = getIndicatorByCode(code);
      const detail = indicator?.description?.trim() ?? "";
      if ("" !== detail) {
        return detail;
      }
      return indicator?.code ?? code;
    })
    .join("\n");
  const comment = company.comment?.trim();
  if (undefined === comment || "" === comment) {
    return description;
  }
  return `${description}\nnote: ${comment}`;
}

export function isValidCompany (company: Partial<Company>): company is Company {
  return (
    "string" === typeof company.linkedinCode
    && 0 < company.linkedinCode.trim().length
    && "string" === typeof company.name
    && 0 < company.name.trim().length
    && Array.isArray(company.indicators)
    && company.indicators.length === normalizeCompanyIndicators(company.indicators).length
    && (company.comment === undefined || "string" === typeof company.comment)
  );
}
