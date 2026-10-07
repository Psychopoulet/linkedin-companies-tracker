import type { Company, CompanyRegistry } from "../types/company";
import { normalizeCompany, normalizeLinkedinCode, normalizeRegistry } from "../types/company";
import { REGISTRY_STORAGE_KEY } from "../storage/constants";

const STORAGE_KEY = REGISTRY_STORAGE_KEY;

export async function getRegistry (): Promise<CompanyRegistry> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const registry = result[STORAGE_KEY];
  if ("object" !== typeof registry || null === registry) {
    return {};
  }

  const { "registry": normalized, changed } = normalizeRegistry(registry as CompanyRegistry);
  if (changed) {
    await saveRegistry(normalized);
  }
  return normalized;
}

async function saveRegistry (registry: CompanyRegistry): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: registry });
}

export async function addCompany (company: Company): Promise<CompanyRegistry> {
  const registry = await getRegistry();
  const next = normalizeCompany(company);
  registry[next.linkedinCode] = next;
  await saveRegistry(registry);
  return registry;
}

export async function updateCompany (company: Company): Promise<CompanyRegistry> {
  const registry = await getRegistry();
  const next = normalizeCompany(company);
  if (!Object.hasOwn(registry, next.linkedinCode)) {
    throw new Error(`Société introuvable : ${next.linkedinCode}`);
  }
  registry[next.linkedinCode] = next;
  await saveRegistry(registry);
  return registry;
}

export async function deleteCompany (linkedinCode: string): Promise<CompanyRegistry> {
  const registry = await getRegistry();
  const code = normalizeLinkedinCode(linkedinCode);
  Reflect.deleteProperty(registry, code);
  await saveRegistry(registry);
  return registry;
}

export async function replaceRegistry (companies: Company[]): Promise<CompanyRegistry> {
  const registry: CompanyRegistry = {};
  for (const company of companies) {
    const next = normalizeCompany(company);
    registry[next.linkedinCode] = next;
  }
  await saveRegistry(registry);
  return registry;
}

export async function broadcastRegistryUpdate (): Promise<void> {
  const tabs = await chrome.tabs.query({ "url": "https://www.linkedin.com/*" });
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      chrome.tabs.sendMessage(tab.id, { "type": "REGISTRY_UPDATED" }).catch(() => {
        // Content script not loaded yet on this tab.
      });
    }
  }
}
