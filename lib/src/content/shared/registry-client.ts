import { REGISTRY_UPDATED } from "../../messages";
import type { CompanyRegistry } from "../../types/company";
import { REGISTRY_STORAGE_KEY } from "../../storage/constants";
import { sendMessage } from "./messaging";

type RegistryListener = (registry: CompanyRegistry) => void;

let registry: CompanyRegistry = {};
const listeners = new Set<RegistryListener>();

export function getCachedRegistry(): CompanyRegistry {
  return registry;
}

export function onRegistryChange(listener: RegistryListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener(registry);
  }
}

function setRegistry(next: CompanyRegistry): void {
  registry = next;
  notifyListeners();
}

export async function loadRegistry(): Promise<CompanyRegistry> {
  const response = await sendMessage({ type: "GET_REGISTRY" });
  if (response.ok) {
    setRegistry(response.registry);
  }
  return registry;
}

export function initRegistrySync(): void {
  chrome.runtime.onMessage.addListener((message: { type?: string }) => {
    if (message.type === REGISTRY_UPDATED) {
      void loadRegistry();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[REGISTRY_STORAGE_KEY]) return;

    const next = changes[REGISTRY_STORAGE_KEY].newValue;
    setRegistry(next && typeof next === "object" ? (next as CompanyRegistry) : {});
  });
}
