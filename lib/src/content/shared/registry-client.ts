// deps

  // locals
  import { REGISTRY_UPDATED } from "../../messages";
  import type { CompanyRegistry } from "../../types/company";
  import { REGISTRY_STORAGE_KEY } from "../../storage/constants";
  import { sendMessage } from "./messaging";

// types & interfaces

  // locals
  type RegistryListener = (registry: CompanyRegistry) => void;

// consts

  const listeners: Set<RegistryListener> = new Set();
  let registry: CompanyRegistry = {};

// module

export function getCachedRegistry (): CompanyRegistry {
  return registry;
}

export function onRegistryChange (listener: RegistryListener): () => void {

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };

}

function notifyListeners (): void {

  for (const listener of listeners) {
    listener(registry);
  }

}

function setRegistry (next: CompanyRegistry): void {
  registry = next;
  notifyListeners();
}

export async function loadRegistry (): Promise<CompanyRegistry> {

  const response = await sendMessage({ "type": "GET_REGISTRY" });

  if (response.ok) {
    setRegistry(response.registry);
  }

  return registry;

}

export function initRegistryListeners (): void {

  chrome.runtime.onMessage.addListener((message: { "type"?: string }) => {

    if (message.type === REGISTRY_UPDATED) {

      loadRegistry().catch((error: unknown) => {
        console.error(error);
      });

    }

  });

  chrome.storage.onChanged.addListener((changes, areaName) => {

    if ("local" !== areaName || !(REGISTRY_STORAGE_KEY in changes)) {
      return;
    }

    const next: unknown = changes[REGISTRY_STORAGE_KEY].newValue;
    setRegistry("object" === typeof next && null !== next ? (next as CompanyRegistry) : {});

  });

}
