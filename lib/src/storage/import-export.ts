// deps

  // locals
  import {
    isValidCompany,
    normalizeCompany,
    companySortRank,
    normalizeLinkedinCode,
    readCompanyIndicators
  } from "../types/company";

// types & interfaces

  // locals
  import type { Company, CompanyRegistry } from "../types/company";

  export interface CompanyExportFile {
    "version": typeof EXPORT_VERSION;
    "exportedAt": string;
    "companies": Company[];
  }

// consts

  export const EXPORT_VERSION = 2 as const;

// private

  // methods

  function _toExportCompany (company: Company): Company {
    return normalizeCompany(company);
  }

  function _compareExportedCompanies (a: Company, b: Company): number {
    const statusDiff = companySortRank(a) - companySortRank(b);
    if (0 !== statusDiff) {
      return statusDiff;
    }
    return a.name.localeCompare(b.name, "fr");
  }

  function _parseJson (text: string): unknown {
    try {
      return JSON.parse(text) as unknown;
    }
    catch {
      throw new Error("Invalid JSON file.");
    }
  }

  function _extractRawCompanies (data: unknown): unknown[] {
    if (Array.isArray(data)) {
      return data;
    }
    if ("object" !== typeof data || null === data) {
      throw new Error("Invalid JSON file: a company array was expected.");
    }

    const record = data as Record<string, unknown>;
    if (Array.isArray(record.companies)) {
      return record.companies;
    }

    const values = Object.values(record);
    if (
      0 < values.length
      && values.every((value) => {
        return "object" === typeof value && null !== value && "linkedinCode" in value;
      })
    ) {
      return values;
    }

    throw new Error("Invalid JSON file: a company array was expected.");
  }

  function _normalizeImportedCompany (item: unknown): Company | null {
    if ("object" !== typeof item || null === item) {
      return null;
    }

    const raw = item as Partial<Company> & { "reason"?: string; "status"?: unknown };
    const indicators = readCompanyIndicators(raw);
    const hasInput = Array.isArray(raw.indicators) ? 0 < raw.indicators.length : raw.status !== undefined;
    if (hasInput && 0 === indicators.length) {
      return null;
    }

    const rawComment = "string" === typeof raw.comment ? raw.comment.trim() : "";
    const rawReason = "string" === typeof raw.reason ? raw.reason.trim() : "";
    const comment = "" === rawComment ? rawReason : rawComment;

    const company: Company = {
      "linkedinCode": "string" === typeof raw.linkedinCode ? normalizeLinkedinCode(raw.linkedinCode) : "",
      "name": "string" === typeof raw.name ? raw.name.trim() : "",
      indicators,
      ..."" === comment ? {} : { comment }
    };

    return isValidCompany(company) ? normalizeCompany(company) : null;
  }

// module

export function serializeCompanies (registry: CompanyRegistry): string {
  const companies = Object.values(registry).map(_toExportCompany).sort(_compareExportedCompanies);
  const payload: CompanyExportFile = {
    "version": EXPORT_VERSION,
    "exportedAt": new Date().toISOString(),
    companies
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function parseCompaniesJson (text: string): Company[] {
  const data = _parseJson(text);

  const companies: Company[] = [];
  for (const item of _extractRawCompanies(data)) {
    const company = _normalizeImportedCompany(item);
    if (!company) {
      throw new Error("Invalid JSON file: one or more companies are incorrect.");
    }
    companies.push(company);
  }
  return companies;
}
