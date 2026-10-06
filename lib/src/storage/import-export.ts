import type { Company, CompanyRegistry } from "../types/company";
import {
  isValidCompany,
  normalizeCompany,
  companySortRank,
  normalizeLinkedinCode,
  readCompanyIndicators,
} from "../types/company";

export const EXPORT_VERSION = 2 as const;

export interface CompanyExportFile {
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  companies: Company[];
}

function toExportCompany(company: Company): Company {
  return normalizeCompany(company);
}

function compareExportedCompanies(a: Company, b: Company): number {
  const statusDiff = companySortRank(a) - companySortRank(b);
  if (statusDiff !== 0) return statusDiff;
  return a.name.localeCompare(b.name, "fr");
}

export function serializeCompanies(registry: CompanyRegistry): string {
  const companies = Object.values(registry).map(toExportCompany).sort(compareExportedCompanies);
  const payload: CompanyExportFile = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    companies,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function parseCompaniesJson(text: string): Company[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Fichier JSON invalide.");
  }

  const companies: Company[] = [];
  for (const item of extractRawCompanies(data)) {
    const company = normalizeImportedCompany(item);
    if (!company) {
      throw new Error("Fichier JSON invalide : une ou plusieurs sociétés sont incorrectes.");
    }
    companies.push(company);
  }
  return companies;
}

function extractRawCompanies(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (!data || typeof data !== "object") {
    throw new Error("Fichier JSON invalide : tableau de sociétés attendu.");
  }

  const record = data as Record<string, unknown>;
  if (Array.isArray(record.companies)) {
    return record.companies;
  }

  const values = Object.values(record);
  if (
    values.length > 0 &&
    values.every((value) => value && typeof value === "object" && "linkedinCode" in value)
  ) {
    return values;
  }

  throw new Error("Fichier JSON invalide : tableau de sociétés attendu.");
}

function normalizeImportedCompany(item: unknown): Company | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Partial<Company> & { reason?: string; status?: unknown };
  const indicators = readCompanyIndicators(raw);
  const hasInput = Array.isArray(raw.indicators) ? raw.indicators.length > 0 : raw.status !== undefined;
  if (hasInput && indicators.length === 0) {
    return null;
  }

  const comment =
    (typeof raw.comment === "string" && raw.comment.trim()) ||
    (typeof raw.reason === "string" && raw.reason.trim()) ||
    "";

  const company: Company = {
    linkedinCode: typeof raw.linkedinCode === "string" ? normalizeLinkedinCode(raw.linkedinCode) : "",
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    indicators,
    ...(comment ? { comment } : {}),
  };

  return isValidCompany(company) ? normalizeCompany(company) : null;
}
