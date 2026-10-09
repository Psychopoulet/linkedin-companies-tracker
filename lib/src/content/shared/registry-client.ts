// deps

  // locals
  import { REGISTRY_UPDATED } from "../../messages";
  import { REGISTRY_STORAGE_KEY } from "../../storage/constants";
  import { sendMessage } from "./messaging";

// types & interfaces

  // locals
  import type { CompanyRegistry } from "../../types/company";

  type RegistryListener = (registry: CompanyRegistry) => void;

// consts

  const listeners: Set<RegistryListener> = new Set();

// private

  // attributes
  let _registry: CompanyRegistry = {};

  // methods

  function _notifyListeners (): void {

    for (const listener of listeners) {
      listener(_registry);
    }

  }

  function _setRegistry (next: CompanyRegistry): void {
    _registry = next;
    _notifyListeners();
  }

// module

export function getCachedRegistry (): CompanyRegistry {
  return _registry;
}

export function onRegistryChange (listener: RegistryListener): () => void {

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };

}

export async function loadRegistry (): Promise<CompanyRegistry> {

  const response = await sendMessage({ "type": "GET_REGISTRY" });

  if (response.ok) {
    _setRegistry(response.registry);
  }

  return _registry;

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
    _setRegistry("object" === typeof next && null !== next ? (next as CompanyRegistry) : {});

  });

}
