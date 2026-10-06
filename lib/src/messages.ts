import type { Company, CompanyRegistry } from "./types/company";

export type Message =
  | { type: "GET_REGISTRY" }
  | { type: "ADD_COMPANY"; company: Company }
  | { type: "UPDATE_COMPANY"; company: Company }
  | { type: "DELETE_COMPANY"; linkedinCode: string }
  | { type: "IMPORT_REGISTRY"; companies: Company[] };

export type MessageResponse =
  | { ok: true; registry: CompanyRegistry }
  | { ok: false; error: string };

export const REGISTRY_UPDATED = "REGISTRY_UPDATED";
